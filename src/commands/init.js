const inquirer = require('inquirer');
const chalk = require('chalk');
const { configManager } = require('../lib/config');
const { authManager } = require('../lib/auth');
const { apiClient } = require('../lib/api');
const { StorageProviderFactory } = require('../lib/storage-providers');
const { generateProjectName, showSuccess, showError, showInfo } = require('../lib/utils');

async function init() {
  try {
    // Check if .envfly already exists
    if (await configManager.configExists()) {
      showError(
        'EnvFly is already initialized in this project.\n\n' +
        'If you want to reinitialize, please remove the .envfly file first.',
        'Already Initialized'
      );
      process.exit(1);
    }

    showInfo(
      'Welcome to EnvFly CLI!\n\n' +
      'This will initialize EnvFly in your current project.\n' +
      'You\'ll be able to sync environment variables across your team.',
      'Initializing EnvFly'
    );

    // Generate default project name
    const defaultProjectName = await generateProjectName();

    // Prompt for project details
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'projectName',
        message: 'Project name:',
        default: defaultProjectName,
        validate: (input) => {
          if (!input || input.trim().length === 0) {
            return 'Project name is required';
          }
          if (input.length > 100) {
            return 'Project name must be 100 characters or less';
          }
          return true;
        }
      },
      {
        type: 'list',
        name: 'storageProvider',
        message: 'Choose storage provider for environment variables:',
        choices: [
          {
            name: 'Git Repository (encrypted) - Store in your Git repo',
            value: 'git'
          },
          {
            name: 'AWS Secrets Manager - Store in AWS',
            value: 'aws'
          },
          {
            name: 'Azure Key Vault - Store in Azure',
            value: 'azure'
          },
          {
            name: 'Google Secret Manager - Store in Google Cloud',
            value: 'google'
          },
          {
            name: 'EnvFly Cloud Service - Use EnvFly hosted service',
            value: 'envfly'
          }
        ]
      }
    ]);

    let storageConfig = {};
    let teamId = null;
    let teamName = null;

    // Configure storage provider
    if (answers.storageProvider === 'envfly') {
      // Use EnvFly cloud service - requires authentication
      const isAuthenticated = await authManager.checkAuth();
      if (!isAuthenticated) {
        showError(
          'You need to authenticate first. Please run "envfly login" before initializing.',
          'Authentication Required'
        );
        process.exit(1);
      }

      await apiClient.initialize();
      const teamResult = await handleTeamSetup();
      teamId = teamResult.teamId;
      teamName = teamResult.teamName;
    } else {
      // Configure custom storage provider
      storageConfig = await configureStorageProvider(answers.storageProvider);
    }

    // Additional project setup questions
    const setupAnswers = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'createSampleEnvs',
        message: 'Create sample environment files?',
        default: true
      },
      {
        type: 'confirm',
        name: 'enableEncryption',
        message: 'Enable encryption for environment variables?',
        default: true
      },
      {
        type: 'confirm',
        name: 'enableAuditLogs',
        message: 'Enable audit logs for environment changes?',
        default: true
      }
    ]);

    // Create configuration
    const config = await configManager.createConfig(answers.projectName, teamId);

    // Update storage configuration
    config.storage = {
      provider: answers.storageProvider,
      config: storageConfig
    };

    // Update additional settings
    if (!setupAnswers.enableEncryption) {
      config.auth.encryption.enabled = false;
    }

    if (setupAnswers.enableAuditLogs) {
      config.sync.audit_logs = true;
    }

    // Add team name if available
    if (teamName) {
      config.team_name = teamName;
    }

    await configManager.saveConfig(config);

    // Test storage provider connection
    if (answers.storageProvider !== 'envfly') {
      await testStorageProvider(answers.storageProvider, storageConfig);
    }

    // Create sample environment files if requested
    if (setupAnswers.createSampleEnvs) {
      await createSampleEnvironmentFiles(config);
    }

    // Show success message
    showSuccess(
      `EnvFly has been initialized successfully!\n\n` +
      `Project: ${chalk.bold(answers.projectName)}\n` +
      `Storage: ${chalk.bold(getStorageProviderName(answers.storageProvider))}\n` +
      `Team: ${chalk.bold(teamName || 'Local only')}\n` +
      `Configuration: ${chalk.bold('.envfly')}\n\n` +
      `Next steps:\n` +
      `1. Run ${chalk.cyan('envfly list')} to see available environments\n` +
      `2. Run ${chalk.cyan('envfly sync <environment>')} to sync an environment\n` +
      `3. Run ${chalk.cyan('envfly push <environment>')} to store environment variables`,
      'Initialization Complete'
    );

  } catch (error) {
    showError(
      `Failed to initialize EnvFly: ${error.message}`,
      'Initialization Failed'
    );
    process.exit(1);
  }
}

/**
 * Configure storage provider settings
 */
async function configureStorageProvider(providerType) {
  const config = {};

  switch (providerType) {
    case 'git':
      const gitAnswers = await inquirer.prompt([
        {
          type: 'input',
          name: 'encryptionKey',
          message: 'Enter encryption key for Git storage:',
          type: 'password',
          validate: (input) => {
            if (!input || input.length < 8) {
              return 'Encryption key must be at least 8 characters';
            }
            return true;
          }
        },
        {
          type: 'input',
          name: 'envPath',
          message: 'Environment files path in Git repo:',
          default: '.envfly-environments'
        }
      ]);
      
      config.encryption_key = gitAnswers.encryptionKey;
      config.git = {
        env_path: gitAnswers.envPath
      };
      break;

    case 'aws':
      const awsAnswers = await inquirer.prompt([
        {
          type: 'input',
          name: 'region',
          message: 'AWS region:',
          default: process.env.AWS_REGION || 'us-east-1'
        },
        {
          type: 'input',
          name: 'prefix',
          message: 'Secret name prefix:',
          default: 'envfly'
        }
      ]);
      
      config.aws = {
        region: awsAnswers.region,
        prefix: awsAnswers.prefix
      };
      break;

    case 'azure':
      const azureAnswers = await inquirer.prompt([
        {
          type: 'input',
          name: 'vaultUrl',
          message: 'Azure Key Vault URL:',
          validate: (input) => {
            if (!input || !input.includes('vault.azure.net')) {
              return 'Please enter a valid Azure Key Vault URL';
            }
            return true;
          }
        },
        {
          type: 'input',
          name: 'prefix',
          message: 'Secret name prefix:',
          default: 'envfly'
        }
      ]);
      
      config.azure = {
        vault_url: azureAnswers.vaultUrl,
        prefix: azureAnswers.prefix
      };
      break;

    case 'google':
      const googleAnswers = await inquirer.prompt([
        {
          type: 'input',
          name: 'projectId',
          message: 'Google Cloud Project ID:',
          default: process.env.GOOGLE_CLOUD_PROJECT || ''
        },
        {
          type: 'input',
          name: 'prefix',
          message: 'Secret name prefix:',
          default: 'envfly'
        }
      ]);
      
      config.google = {
        project_id: googleAnswers.projectId,
        prefix: googleAnswers.prefix
      };
      break;
  }

  return config;
}

/**
 * Test storage provider connection
 */
async function testStorageProvider(providerType, config) {
  const spinner = require('../lib/utils').createSpinner('Testing storage provider connection...');
  spinner.start();

  try {
    const provider = await StorageProviderFactory.create(providerType, config);
    spinner.succeed('Storage provider connection successful');
  } catch (error) {
    spinner.fail('Storage provider connection failed');
    throw new Error(`Storage provider test failed: ${error.message}`);
  }
}

/**
 * Handle team setup for EnvFly cloud service
 */
async function handleTeamSetup() {
  const { teamSelection } = await inquirer.prompt([
    {
      type: 'list',
      name: 'teamSelection',
      message: 'How would you like to set up team access?',
      choices: [
        {
          name: 'Select existing team',
          value: 'select'
        },
        {
          name: 'Create new team',
          value: 'create'
        },
        {
          name: 'Join team with invite code',
          value: 'join'
        },
        {
          name: 'Skip team setup (local only)',
          value: 'skip'
        }
      ]
    }
  ]);

  let teamId = null;
  let teamName = null;

  if (teamSelection === 'select') {
    const teamResult = await handleTeamSelection();
    teamId = teamResult.teamId;
    teamName = teamResult.teamName;
  } else if (teamSelection === 'create') {
    const teamResult = await handleTeamCreation();
    teamId = teamResult.teamId;
    teamName = teamResult.teamName;
  } else if (teamSelection === 'join') {
    const teamResult = await handleTeamJoin();
    teamId = teamResult.teamId;
    teamName = teamResult.teamName;
  }

  return { teamId, teamName };
}

/**
 * Get storage provider display name
 */
function getStorageProviderName(providerType) {
  const providers = {
    'git': 'Git Repository',
    'aws': 'AWS Secrets Manager',
    'azure': 'Azure Key Vault',
    'google': 'Google Secret Manager',
    'envfly': 'EnvFly Cloud Service'
  };
  return providers[providerType] || providerType;
}

/**
 * Handle team selection from existing teams
 */
async function handleTeamSelection() {
  try {
    const teams = await apiClient.getUserTeams();
    
    if (teams.length === 0) {
      showInfo(
        'You are not a member of any teams yet.\n' +
        'Would you like to create a new team instead?',
        'No Teams Available'
      );
      
      const { createNew } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'createNew',
          message: 'Create a new team?',
          default: true
        }
      ]);
      
      if (createNew) {
        return await handleTeamCreation();
      } else {
        return { teamId: null, teamName: null };
      }
    }

    const { selectedTeam } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedTeam',
        message: 'Select a team for this project:',
        choices: teams.map(team => ({
          name: `${team.name} (${team.member_count} members)`,
          value: team.id,
          short: team.name
        }))
      }
    ]);

    const team = teams.find(t => t.id === selectedTeam);
    return { teamId: selectedTeam, teamName: team.name };

  } catch (error) {
    throw new Error(`Failed to fetch teams: ${error.message}`);
  }
}

/**
 * Handle team creation
 */
async function handleTeamCreation() {
  const { teamName } = await inquirer.prompt([
    {
      type: 'input',
      name: 'teamName',
      message: 'Team name:',
      validate: (input) => {
        if (!input || input.trim().length === 0) {
          return 'Team name is required';
        }
        if (input.length > 50) {
          return 'Team name must be 50 characters or less';
        }
        return true;
      }
    }
  ]);

  const spinner = require('../lib/utils').createSpinner('Creating team...');
  spinner.start();

  try {
    const teamData = {
      name: teamName,
      description: `Team for ${teamName}`,
      settings: {
        encryption_enabled: true,
        audit_logs: true,
        auto_backup: true
      }
    };

    const team = await apiClient.createTeam(teamData);
    spinner.succeed('Team created successfully');

    showSuccess(
      `Team "${chalk.bold(teamName)}" created successfully!\n\n` +
      `Team ID: ${chalk.bold(team.id)}\n` +
      `Invite Code: ${chalk.bold(team.invite_code)}\n\n` +
      `Share this invite code with your team members:\n` +
      `${chalk.cyan(`envfly team join ${team.invite_code}`)}`,
      'Team Created'
    );

    return { teamId: team.id, teamName: team.name };

  } catch (error) {
    spinner.fail('Failed to create team');
    throw error;
  }
}

/**
 * Handle team joining via invite code
 */
async function handleTeamJoin() {
  const { inviteCode } = await inquirer.prompt([
    {
      type: 'input',
      name: 'inviteCode',
      message: 'Enter team invite code:',
      validate: (input) => {
        if (!input || input.trim().length === 0) {
          return 'Invite code is required';
        }
        return true;
      }
    }
  ]);

  const spinner = require('../lib/utils').createSpinner('Joining team...');
  spinner.start();

  try {
    const joinData = {
      invite_code: inviteCode.trim()
    };

    const team = await apiClient.joinTeam(joinData);
    spinner.succeed('Successfully joined team');

    showSuccess(
      `Successfully joined ${chalk.bold(team.name)}!\n\n` +
      `Team ID: ${chalk.bold(team.id)}\n` +
      `Your Role: ${chalk.bold(team.role)}\n` +
      `Member Count: ${chalk.bold(team.member_count)}`,
      'Team Joined'
    );

    return { teamId: team.id, teamName: team.name };

  } catch (error) {
    spinner.fail('Failed to join team');
    throw error;
  }
}

/**
 * Create sample environment files
 */
async function createSampleEnvironmentFiles(config) {
  const fs = require('fs-extra');
  const path = require('path');

  const sampleEnvs = {
    '.env.production': `# Production Environment Variables
DATABASE_URL=postgresql://user:pass@prod-db:5432/mydb
API_KEY=prod_api_key_here
REDIS_URL=redis://prod-redis:6379
LOG_LEVEL=error
NODE_ENV=production`,

    '.env.staging': `# Staging Environment Variables
DATABASE_URL=postgresql://user:pass@staging-db:5432/mydb
API_KEY=staging_api_key_here
REDIS_URL=redis://staging-redis:6379
LOG_LEVEL=warn
NODE_ENV=staging`,

    '.env.development': `# Development Environment Variables
DATABASE_URL=postgresql://user:pass@localhost:5432/mydb
API_KEY=dev_api_key_here
REDIS_URL=redis://localhost:6379
LOG_LEVEL=debug
NODE_ENV=development`
  };

  for (const [filename, content] of Object.entries(sampleEnvs)) {
    const filePath = path.join(process.cwd(), filename);
    
    // Only create if file doesn't exist
    if (!await fs.pathExists(filePath)) {
      await fs.writeFile(filePath, content, 'utf8');
      console.log(chalk.green(`✓ Created ${filename}`));
    } else {
      console.log(chalk.yellow(`⚠ Skipped ${filename} (already exists)`));
    }
  }
}

module.exports = init; 