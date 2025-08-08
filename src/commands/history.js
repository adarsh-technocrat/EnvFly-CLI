const chalk = require('chalk');
const { configManager } = require('../lib/config');
const { authManager } = require('../lib/auth');
const { apiClient } = require('../lib/api');
const { showSuccess, showError, showInfo, createSpinner, formatDate } = require('../lib/utils');

async function history(environment) {
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

    // Validate environment name
    if (!environment) {
      showError(
        'Environment name is required. Use "envfly history <environment>"',
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

    // Check if environment has remote ID
    if (!envConfig.remote_id) {
      showError(
        `Environment "${environment}" is not connected to a remote environment.\n\n` +
        `Use "envfly push ${environment}" to create a remote environment first.`,
        'No Remote Environment'
      );
      process.exit(1);
    }

    await showEnvironmentHistory(environment, envConfig, config);

  } catch (error) {
    showError(
      `History command failed: ${error.message}`,
      'History Failed'
    );
    process.exit(1);
  }
}

/**
 * Show environment history
 */
async function showEnvironmentHistory(envName, envConfig, config) {
  const spinner = createSpinner(`Fetching history for ${envName}...`);
  spinner.start();

  try {
    const history = await apiClient.getEnvironmentHistory(config.project_id, envConfig.remote_id);
    spinner.succeed('History loaded');

    if (history.length === 0) {
      showInfo(
        `No history available for ${envName}.\n\n` +
        `This environment hasn't been updated yet.`,
        'No History'
      );
      return;
    }

    console.log(chalk.blue(`\n📜 History for ${envName}`));
    console.log(chalk.gray('─'.repeat(80)));

    for (let i = 0; i < history.length; i++) {
      const version = history[i];
      const isCurrent = i === 0;
      
      console.log(`${isCurrent ? chalk.green('→') : ' '} Version ${chalk.bold(version.version)}`);
      console.log(`  Updated: ${formatDate(version.updated_at)}`);
      console.log(`  By: ${chalk.cyan(version.updated_by)}`);
      console.log(`  Variables: ${chalk.bold(version.variable_count)}`);
      console.log(`  Message: ${version.message || 'No message'}`);
      
      if (version.changes) {
        console.log(`  Changes:`);
        version.changes.forEach(change => {
          const symbol = change.type === 'added' ? chalk.green('+') : 
                        change.type === 'removed' ? chalk.red('-') : 
                        chalk.yellow('~');
          console.log(`    ${symbol} ${change.key}`);
        });
      }
      console.log('');
    }

    // Show rollback option
    if (history.length > 1) {
      console.log(chalk.blue('\n🔄 Rollback Options'));
      console.log(chalk.gray('─'.repeat(40)));
      console.log(`To rollback to a previous version:`);
      console.log(`${chalk.cyan(`envfly rollback ${envName} --version <version>`)}`);
      console.log(`Example: ${chalk.cyan(`envfly rollback ${envName} --version ${history[1].version}`)}`);
    }

  } catch (error) {
    spinner.fail(`Failed to fetch history for ${envName}`);
    throw error;
  }
}

module.exports = history; 