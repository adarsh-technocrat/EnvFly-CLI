const inquirer = require('inquirer');
const chalk = require('chalk');
const { configManager } = require('../lib/config');
const { authManager } = require('../lib/auth');
const { apiClient } = require('../lib/api');
const { envParser } = require('../lib/env-parser');
const { cryptoManager } = require('../lib/crypto');
const { showSuccess, showError, showInfo, createSpinner, formatDate } = require('../lib/utils');

async function sync(environment, options = {}) {
  try {
    // Load configuration
    const config = await configManager.loadConfig();
    
    // Check authentication
    const isAuthenticated = await authManager.checkAuth();
    if (!isAuthenticated) {
      showError(
        'You are not authenticated. Please run "envfly login" first.',
        'Authentication Required'
      );
      process.exit(1);
    }

    // Initialize API client
    await apiClient.initialize();

    // Handle --all flag
    if (options.all) {
      await syncAllEnvironments(config, options);
      return;
    }

    // Validate environment name
    if (!environment) {
      showError(
        'Environment name is required. Use "envfly sync <environment>" or "envfly sync --all"',
        'Environment Required'
      );
      process.exit(1);
    }

    // Check if environment exists in config
    const envConfig = config.environments[environment];
    if (!envConfig) {
      showError(
        `Environment "${environment}" not found in configuration.\n\n` +
        `Available environments: ${Object.keys(config.environments).join(', ')}`,
        'Environment Not Found'
      );
      process.exit(1);
    }

    await syncEnvironment(environment, envConfig, config, options);

  } catch (error) {
    showError(
      `Sync failed: ${error.message}`,
      'Sync Failed'
    );
    process.exit(1);
  }
}

/**
 * Sync all environments
 */
async function syncAllEnvironments(config, options) {
  showInfo(
    'Syncing all environments...',
    'Sync All Environments'
  );

  const environments = Object.keys(config.environments);
  const results = [];

  for (const envName of environments) {
    try {
      const envConfig = config.environments[envName];
      await syncEnvironment(envName, envConfig, config, options);
      results.push({ name: envName, status: 'success' });
    } catch (error) {
      console.log(chalk.red(`✗ Failed to sync ${envName}: ${error.message}`));
      results.push({ name: envName, status: 'failed', error: error.message });
    }
  }

  // Show summary
  const successful = results.filter(r => r.status === 'success').length;
  const failed = results.filter(r => r.status === 'failed').length;

  if (failed === 0) {
    showSuccess(
      `Successfully synced all ${successful} environments!`,
      'Sync Complete'
    );
  } else {
    showError(
      `Synced ${successful} environments, ${failed} failed.`,
      'Sync Partial'
    );
  }
}

/**
 * Sync single environment
 */
async function syncEnvironment(envName, envConfig, config, options) {
  const spinner = createSpinner(`Syncing ${envName} environment...`);
  spinner.start();

  try {
    // Get local environment file path
    const localFilePath = envParser.getEnvFilePath(envName, config);
    
    // Read local environment
    let localEnv = {};
    try {
      localEnv = await envParser.readEnvFile(localFilePath);
    } catch (error) {
      // Local file doesn't exist, that's okay
      console.log(chalk.yellow(`⚠ Local file ${envConfig.file} not found`));
    }

    // Get remote environment
    let remoteEnv = {};
    let remoteId = envConfig.remote_id;

    if (remoteId) {
      try {
        const remoteData = await apiClient.getEnvironment(config.project_id, remoteId);
        if (remoteData.encrypted && cryptoManager.isEncryptionEnabled(config)) {
          const decrypted = await cryptoManager.decryptFileContent(remoteData.variables);
          remoteEnv = envParser.parseEnvContent(decrypted);
        } else {
          remoteEnv = remoteData.variables || {};
        }
      } catch (error) {
        console.log(chalk.yellow(`⚠ Could not fetch remote environment: ${error.message}`));
      }
    }

    spinner.stop();

    // Detect conflicts
    const conflicts = envParser.detectConflicts(localEnv, remoteEnv);
    const hasConflicts = conflicts.added.length > 0 || conflicts.removed.length > 0 || conflicts.modified.length > 0;

    if (hasConflicts) {
      console.log(chalk.yellow('\n⚠ Conflicts detected between local and remote environments:'));
      console.log(envParser.generateDiffReport(conflicts));

      if (!options.force) {
        const resolution = await promptConflictResolution(conflicts);
        await resolveConflicts(envName, localEnv, remoteEnv, conflicts, resolution, localFilePath, config);
      } else {
        // Force mode - use remote
        await envParser.writeEnvFile(localFilePath, remoteEnv);
        console.log(chalk.green(`✓ Updated local environment with remote values (force mode)`));
      }
    } else {
      console.log(chalk.green(`✓ Environment ${envName} is already in sync`));
    }

    // Update last sync time in config
    envConfig.last_sync = new Date().toISOString();
    await configManager.saveConfig(config);

    showSuccess(
      `Environment ${chalk.bold(envName)} synced successfully!\n\n` +
      `Local file: ${chalk.bold(envConfig.file)}\n` +
      `Variables: ${chalk.bold(Object.keys(localEnv).length)} local, ${chalk.bold(Object.keys(remoteEnv).length)} remote\n` +
      `Last sync: ${chalk.bold(formatDate(envConfig.last_sync))}`,
      'Sync Complete'
    );

  } catch (error) {
    spinner.fail(`Failed to sync ${envName}`);
    throw error;
  }
}

/**
 * Prompt user for conflict resolution
 */
async function promptConflictResolution(conflicts) {
  const choices = [
    {
      name: 'Use local values (overwrite remote)',
      value: 'local'
    },
    {
      name: 'Use remote values (overwrite local)',
      value: 'remote'
    },
    {
      name: 'Merge (keep both, remote wins on conflicts)',
      value: 'merge'
    },
    {
      name: 'Cancel sync',
      value: 'cancel'
    }
  ];

  const { resolution } = await inquirer.prompt([
    {
      type: 'list',
      name: 'resolution',
      message: 'How would you like to resolve these conflicts?',
      choices
    }
  ]);

  if (resolution === 'cancel') {
    showInfo('Sync cancelled by user.', 'Sync Cancelled');
    process.exit(0);
  }

  return resolution;
}

/**
 * Resolve conflicts based on user choice
 */
async function resolveConflicts(envName, localEnv, remoteEnv, conflicts, resolution, localFilePath, config) {
  let finalEnv;

  switch (resolution) {
    case 'local':
      finalEnv = { ...remoteEnv, ...localEnv };
      break;
    
    case 'remote':
      finalEnv = { ...localEnv, ...remoteEnv };
      break;
    
    case 'merge':
      finalEnv = { ...localEnv, ...remoteEnv };
      break;
    
    default:
      throw new Error(`Unknown resolution strategy: ${resolution}`);
  }

  // Create backup
  const backupPath = await envParser.createBackup(localFilePath);
  if (backupPath) {
    console.log(chalk.blue(`✓ Created backup: ${backupPath}`));
  }

  // Write merged environment
  await envParser.writeEnvFile(localFilePath, finalEnv);
  console.log(chalk.green(`✓ Updated local environment with ${resolution} strategy`));

  // Update remote if using local strategy
  if (resolution === 'local' && config.environments[envName].remote_id) {
    const spinner = createSpinner('Updating remote environment...');
    spinner.start();

    try {
      const encrypted = await cryptoManager.encryptFileContent(envParser.stringifyEnvContent(finalEnv));
      await apiClient.updateEnvironment(
        config.project_id,
        config.environments[envName].remote_id,
        encrypted
      );
      spinner.succeed('Remote environment updated');
    } catch (error) {
      spinner.fail('Failed to update remote environment');
      console.log(chalk.yellow(`⚠ Remote update failed: ${error.message}`));
    }
  }
}

module.exports = sync; 