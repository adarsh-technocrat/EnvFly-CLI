const chalk = require('chalk');
const { configManager } = require('../lib/config');
const { authManager } = require('../lib/auth');
const { apiClient } = require('../lib/api');
const { StorageProviderFactory } = require('../lib/storage-providers');
const { envParser } = require('../lib/env-parser');
const { cryptoManager } = require('../lib/crypto');
const { showSuccess, showError, showInfo, createSpinner, formatDate } = require('../lib/utils');

async function push(environment) {
  try {
    // Load configuration
    const config = await configManager.loadConfig();
    
    // Validate environment name
    if (!environment) {
      showError(
        'Environment name is required. Use "envfly push <environment>"',
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

    // Get storage provider
    const storageProvider = config.storage?.provider || 'envfly';
    
    if (storageProvider === 'envfly') {
      // Use EnvFly cloud service
      await pushToEnvFly(environment, envConfig, config);
    } else {
      // Use custom storage provider
      await pushToStorageProvider(environment, envConfig, config);
    }

  } catch (error) {
    showError(
      `Push failed: ${error.message}`,
      'Push Failed'
    );
    process.exit(1);
  }
}

/**
 * Push to EnvFly cloud service
 */
async function pushToEnvFly(environment, envConfig, config) {
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

  const spinner = createSpinner(`Pushing ${environment} environment...`);
  spinner.start();

  try {
    // Get local environment file path
    const localFilePath = envParser.getEnvFilePath(environment, config);
    
    // Read local environment
    let localEnv;
    try {
      localEnv = await envParser.readEnvFile(localFilePath);
    } catch (error) {
      spinner.fail(`Local environment file not found: ${envConfig.file}`);
      throw new Error(`Local environment file not found: ${envConfig.file}`);
    }

    // Validate environment
    const validation = envParser.validateEnvironment(localEnv);
    if (!validation.valid) {
      spinner.fail('Environment validation failed');
      console.log(chalk.red('Validation errors:'));
      validation.errors.forEach(error => console.log(chalk.red(`  • ${error}`)));
      throw new Error('Environment validation failed');
    }

    spinner.text = 'Encrypting environment variables...';

    // Encrypt environment variables if enabled
    let encryptedData;
    if (cryptoManager.isEncryptionEnabled(config)) {
      const envContent = envParser.stringifyEnvContent(localEnv);
      encryptedData = await cryptoManager.encryptFileContent(envContent);
    } else {
      encryptedData = localEnv;
    }

    spinner.text = 'Uploading to EnvFly...';

    // Create or update remote environment
    let remoteId = envConfig.remote_id;
    
    if (remoteId) {
      // Update existing environment
      await apiClient.updateEnvironment(config.project_id, remoteId, encryptedData);
      console.log(chalk.blue(`✓ Updated existing remote environment`));
    } else {
      // Create new environment
      const newEnvData = {
        name: environment,
        description: envConfig.description || `${environment} environment`,
        variables: encryptedData,
        encrypted: cryptoManager.isEncryptionEnabled(config)
      };

      const createdEnv = await apiClient.createEnvironment(config.project_id, newEnvData);
      remoteId = createdEnv.id;
      
      // Update config with new remote ID
      envConfig.remote_id = remoteId;
      await configManager.saveConfig(config);
      
      console.log(chalk.blue(`✓ Created new remote environment`));
    }

    // Update last push time
    envConfig.last_push = new Date().toISOString();
    await configManager.saveConfig(config);

    spinner.succeed(`Successfully pushed ${environment} environment`);

    showSuccess(
      `Environment ${chalk.bold(environment)} pushed successfully!\n\n` +
      `Local file: ${chalk.bold(envConfig.file)}\n` +
      `Remote ID: ${chalk.bold(remoteId)}\n` +
      `Variables: ${chalk.bold(Object.keys(localEnv).length)}\n` +
      `Encrypted: ${chalk.bold(cryptoManager.isEncryptionEnabled(config) ? 'Yes' : 'No')}\n` +
      `Last push: ${chalk.bold(formatDate(envConfig.last_push))}`,
      'Push Complete'
    );

  } catch (error) {
    spinner.fail(`Failed to push ${environment}`);
    throw error;
  }
}

/**
 * Push to custom storage provider
 */
async function pushToStorageProvider(environment, envConfig, config) {
  const spinner = createSpinner(`Pushing ${environment} to ${config.storage.provider}...`);
  spinner.start();

  try {
    // Get local environment file path
    const localFilePath = envParser.getEnvFilePath(environment, config);
    
    // Read local environment
    let localEnv;
    try {
      localEnv = await envParser.readEnvFile(localFilePath);
    } catch (error) {
      spinner.fail(`Local environment file not found: ${envConfig.file}`);
      throw new Error(`Local environment file not found: ${envConfig.file}`);
    }

    // Validate environment
    const validation = envParser.validateEnvironment(localEnv);
    if (!validation.valid) {
      spinner.fail('Environment validation failed');
      console.log(chalk.red('Validation errors:'));
      validation.errors.forEach(error => console.log(chalk.red(`  • ${error}`)));
      throw new Error('Environment validation failed');
    }

    spinner.text = 'Storing environment variables...';

    // Create storage provider
    const provider = await StorageProviderFactory.create(config.storage.provider, config.storage.config);
    
    // Store environment variables
    const metadata = await provider.store(environment, localEnv);

    // Update last push time
    envConfig.last_push = new Date().toISOString();
    await configManager.saveConfig(config);

    spinner.succeed(`Successfully pushed ${environment} environment`);

    showSuccess(
      `Environment ${chalk.bold(environment)} pushed successfully!\n\n` +
      `Local file: ${chalk.bold(envConfig.file)}\n` +
      `Storage: ${chalk.bold(config.storage.provider)}\n` +
      `Variables: ${chalk.bold(Object.keys(localEnv).length)}\n` +
      `Last push: ${chalk.bold(formatDate(envConfig.last_push))}`,
      'Push Complete'
    );

  } catch (error) {
    spinner.fail(`Failed to push ${environment}`);
    throw error;
  }
}

module.exports = push; 