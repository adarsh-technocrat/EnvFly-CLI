const inquirer = require('inquirer');
const chalk = require('chalk');
const { authManager } = require('../lib/auth');
const { configManager } = require('../lib/config');
const { showSuccess, showError, showInfo, createSpinner } = require('../lib/utils');

async function login() {
  try {
    // Check if configuration exists
    let config;
    try {
      config = await configManager.loadConfig();
    } catch (error) {
      showError(
        'No EnvFly configuration found. Please run "envfly init" first.',
        'Configuration Missing'
      );
      process.exit(1);
    }

    showInfo(
      'Authenticate with EnvFly to sync your environment variables.\n\n' +
      'You can get your API key from your EnvFly dashboard.',
      'Login to EnvFly'
    );

    // Check if already authenticated
    const isAuthenticated = await authManager.checkAuth();
    if (isAuthenticated) {
      const { overwrite } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: 'You are already logged in. Do you want to login with a different API key?',
          default: false
        }
      ]);

      if (!overwrite) {
        showInfo('Login cancelled.', 'Login Cancelled');
        return;
      }
    }

    // Prompt for API key
    const answers = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: 'Enter your EnvFly API key:',
        mask: '*',
        validate: (input) => {
          if (!input || input.trim().length === 0) {
            return 'API key is required';
          }
          if (input.length < 10) {
            return 'API key seems too short';
          }
          return true;
        }
      }
    ]);

    // Show spinner during authentication
    const spinner = createSpinner('Authenticating with EnvFly...');
    spinner.start();

    try {
      // Attempt to login
      await authManager.login(answers.apiKey.trim());
      spinner.succeed('Authentication successful!');

      // Get user profile if possible
      try {
        const { apiClient } = require('../lib/api');
        await apiClient.initialize();
        const profile = await apiClient.getUserProfile();
        
        showSuccess(
          `Welcome back, ${chalk.bold(profile.name || 'User')}!\n\n` +
          `Email: ${chalk.bold(profile.email || 'N/A')}\n` +
          `Team: ${chalk.bold(profile.team || 'N/A')}\n\n` +
          `You can now use EnvFly commands:\n` +
          `• ${chalk.cyan('envfly list')} - List environments\n` +
          `• ${chalk.cyan('envfly sync <env>')} - Sync environment\n` +
          `• ${chalk.cyan('envfly push <env>')} - Push local changes\n` +
          `• ${chalk.cyan('envfly pull <env>')} - Pull remote changes`,
          'Login Successful'
        );
      } catch (profileError) {
        // Profile fetch failed, but login was successful
        showSuccess(
          `Authentication successful!\n\n` +
          `You can now use EnvFly commands:\n` +
          `• ${chalk.cyan('envfly list')} - List environments\n` +
          `• ${chalk.cyan('envfly sync <env>')} - Sync environment\n` +
          `• ${chalk.cyan('envfly push <env>')} - Push local changes\n` +
          `• ${chalk.cyan('envfly pull <env>')} - Pull remote changes`,
          'Login Successful'
        );
      }

    } catch (authError) {
      spinner.fail('Authentication failed');
      throw authError;
    }

  } catch (error) {
    showError(
      `Login failed: ${error.message}\n\n` +
      `Please check your API key and try again.\n` +
      `You can get your API key from your EnvFly dashboard.`,
      'Login Failed'
    );
    process.exit(1);
  }
}

module.exports = login; 