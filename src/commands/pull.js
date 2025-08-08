const chalk = require('chalk');
const { configManager } = require('../lib/config');
const { authManager } = require('../lib/auth');
const { apiClient } = require('../lib/api');
const { StorageProviderFactory } = require('../lib/storage-providers');
const { envParser } = require('../lib/env-parser');
const { cryptoManager } = require('../lib/crypto');
const { showSuccess, showError, showInfo, createSpinner, formatDate } = require('../lib/utils');

async function pull(environment) {
  try {
    // Load configuration
    const config = await configManager.loadConfig();
    
    // Validate environment name
    if (!environment) {
      showError(
        'Environment name is required. Use "envfly pull <environment>"',
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
      await pullFromEnvFly(environment, envConfig, config);
    } else {
      // Use custom storage provider
      await pullFromStorageProvider(environment, envConfig, config);
    }

  } catch (error) {
    showError(
      `Pull failed: ${error.message}`,
      'Pull Failed'
    );
    process.exit(1);
  }
}

/**
 * Pull from EnvFly cloud service
 */
async function pullFromEnvFly(environment, envConfig, config) {
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

  // Check if environment has remote ID
  if (!envConfig.remote_id) {
    showError(
      `Environment "${environment}" is not connected to a remote environment.\n\n` +
      `Use "envfly push ${environment}" to create a remote environment first.`,
      'No Remote Environment'
    );
    process.exit(1);
  }

  const spinner = createSpinner(`Pulling ${environment} environment...`);
  spinner.start();

  try {
    // Get local environment file path
    const localFilePath = envParser.getEnvFilePath(environment, config);
    
    // Create backup of existing file
    const backupPath = await envParser.createBackup(localFilePath);
    if (backupPath) {
      console.log(chalk.blue(`✓ Created backup: ${backupPath}`));
    }

    spinner.text = 'Fetching from EnvFly...';

    // Fetch remote environment
    const remoteData = await apiClient.getEnvironment(config.project_id, envConfig.remote_id);
    
    if (!remoteData || !remoteData.variables) {
      throw new Error('Remote environment is empty or invalid');
    }

    spinner.text = 'Decrypting environment variables...';

    // Decrypt environment variables if encrypted
    let remoteEnv;
    if (remoteData.encrypted && cryptoManager.isEncryptionEnabled(config)) {
      const decrypted = await cryptoManager.decryptFileContent(remoteData.variables);
      remoteEnv = envParser.parseEnvContent(decrypted);
    } else {
      remoteEnv = remoteData.variables || {};
    }

    // Validate remote environment
    const validation = envParser.validateEnvironment(remoteEnv);
    if (!validation.valid) {
      spinner.fail('Remote environment validation failed');
      console.log(chalk.red('Validation errors:'));
      validation.errors.forEach(error => console.log(chalk.red(`  • ${error}`)));
      throw new Error('Remote environment validation failed');
    }

    spinner.text = 'Writing to local file...';

    // Write to local file
    await envParser.writeEnvFile(localFilePath, remoteEnv);

    // Update last pull time
    envConfig.last_pull = new Date().toISOString();
    await configManager.saveConfig(config);

    spinner.succeed(`Successfully pulled ${environment} environment`);

    // Show summary
    const variableCount = Object.keys(remoteEnv).length;
    const fileSize = require('fs').statSync(localFilePath).size;

    showSuccess(
      `Environment ${chalk.bold(environment)} pulled successfully!\n\n` +
      `Local file: ${chalk.bold(envConfig.file)}\n` +
      `Remote ID: ${chalk.bold(envConfig.remote_id)}\n` +
      `Variables: ${chalk.bold(variableCount)}\n` +
      `File size: ${chalk.bold(require('../lib/utils').formatFileSize(fileSize))}\n` +
      `Last pull: ${chalk.bold(formatDate(envConfig.last_pull))}`,
      'Pull Complete'
    );

    // Show variable preview
    if (variableCount > 0) {
      console.log(chalk.blue('\nEnvironment variables:'));
      const previewVars = Object.entries(remoteEnv).slice(0, 5);
      previewVars.forEach(([key, value]) => {
        const maskedValue = value.length > 20 ? value.substring(0, 20) + '...' : value;
        console.log(chalk.gray(`  ${key}=${maskedValue}`));
      });
      
      if (variableCount > 5) {
        console.log(chalk.gray(`  ... and ${variableCount - 5} more variables`));
      }
    }

  } catch (error) {
    spinner.fail(`Failed to pull ${environment}`);
    throw error;
  }
}

/**
 * Pull from custom storage provider
 */
async function pullFromStorageProvider(environment, envConfig, config) {
  const spinner = createSpinner(`Pulling ${environment} from ${config.storage.provider}...`);
  spinner.start();

  try {
    // Get local environment file path
    const localFilePath = envParser.getEnvFilePath(environment, config);
    
    // Create backup of existing file
    const backupPath = await envParser.createBackup(localFilePath);
    if (backupPath) {
      console.log(chalk.blue(`✓ Created backup: ${backupPath}`));
    }

    spinner.text = 'Retrieving environment variables...';

    // Create storage provider
    const provider = await StorageProviderFactory.create(config.storage.provider, config.storage.config);
    
    // Retrieve environment variables
    const result = await provider.retrieve(environment);
    const remoteEnv = result.variables;

    // Validate remote environment
    const validation = envParser.validateEnvironment(remoteEnv);
    if (!validation.valid) {
      spinner.fail('Remote environment validation failed');
      console.log(chalk.red('Validation errors:'));
      validation.errors.forEach(error => console.log(chalk.red(`  • ${error}`)));
      throw new Error('Remote environment validation failed');
    }

    spinner.text = 'Writing to local file...';

    // Write to local file
    await envParser.writeEnvFile(localFilePath, remoteEnv);

    // Update last pull time
    envConfig.last_pull = new Date().toISOString();
    await configManager.saveConfig(config);

    spinner.succeed(`Successfully pulled ${environment} environment`);

    // Show summary
    const variableCount = Object.keys(remoteEnv).length;
    const fileSize = require('fs').statSync(localFilePath).size;

    showSuccess(
      `Environment ${chalk.bold(environment)} pulled successfully!\n\n` +
      `Local file: ${chalk.bold(envConfig.file)}\n` +
      `Storage: ${chalk.bold(config.storage.provider)}\n` +
      `Variables: ${chalk.bold(variableCount)}\n` +
      `File size: ${chalk.bold(require('../lib/utils').formatFileSize(fileSize))}\n` +
      `Last pull: ${chalk.bold(formatDate(envConfig.last_pull))}`,
      'Pull Complete'
    );

    // Show variable preview
    if (variableCount > 0) {
      console.log(chalk.blue('\nEnvironment variables:'));
      const previewVars = Object.entries(remoteEnv).slice(0, 5);
      previewVars.forEach(([key, value]) => {
        const maskedValue = value.length > 20 ? value.substring(0, 20) + '...' : value;
        console.log(chalk.gray(`  ${key}=${maskedValue}`));
      });
      
      if (variableCount > 5) {
        console.log(chalk.gray(`  ... and ${variableCount - 5} more variables`));
      }
    }

  } catch (error) {
    spinner.fail(`Failed to pull ${environment}`);
    throw error;
  }
}

module.exports = pull; 