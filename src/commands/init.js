const inquirer = require('inquirer');
const chalk = require('chalk');
const { configManager } = require('../lib/config');
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
        type: 'input',
        name: 'teamId',
        message: 'Team ID:',
        validate: (input) => {
          if (!input || input.trim().length === 0) {
            return 'Team ID is required';
          }
          return true;
        }
      },
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
      }
    ]);

    // Create configuration
    const config = await configManager.createConfig(answers.projectName, answers.teamId);

    // Update encryption settings
    if (!answers.enableEncryption) {
      config.auth.encryption.enabled = false;
      await configManager.saveConfig(config);
    }

    // Create sample environment files if requested
    if (answers.createSampleEnvs) {
      await createSampleEnvironmentFiles(config);
    }

    // Show success message
    showSuccess(
      `EnvFly has been initialized successfully!\n\n` +
      `Project: ${chalk.bold(answers.projectName)}\n` +
      `Team ID: ${chalk.bold(answers.teamId)}\n` +
      `Configuration: ${chalk.bold('.envfly')}\n\n` +
      `Next steps:\n` +
      `1. Run ${chalk.cyan('envfly login')} to authenticate\n` +
      `2. Run ${chalk.cyan('envfly list')} to see available environments\n` +
      `3. Run ${chalk.cyan('envfly sync <environment>')} to sync an environment`,
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