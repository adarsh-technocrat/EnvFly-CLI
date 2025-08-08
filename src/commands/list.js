const chalk = require('chalk');
const { configManager } = require('../lib/config');
const { authManager } = require('../lib/auth');
const { apiClient } = require('../lib/api');
const { StorageProviderFactory } = require('../lib/storage-providers');
const { envParser } = require('../lib/env-parser');
const { showSuccess, showError, showInfo, createSpinner, formatDate, formatFileSize } = require('../lib/utils');

async function list() {
  try {
    // Load configuration
    const config = await configManager.loadConfig();
    
    const spinner = createSpinner('Loading environment information...');
    spinner.start();

    // Get storage provider
    const storageProvider = config.storage?.provider || 'envfly';
    
    let remoteEnvironments = [];
    
    if (storageProvider === 'envfly') {
      // Get environments from EnvFly cloud service
      remoteEnvironments = await getEnvFlyEnvironments(config);
    } else {
      // Get environments from custom storage provider
      remoteEnvironments = await getStorageProviderEnvironments(config);
    }

    // Get local environments
    const localEnvironments = await getLocalEnvironments(config);

    spinner.succeed('Environment information loaded');

    // Display environments
    displayEnvironments(config, localEnvironments, remoteEnvironments);

  } catch (error) {
    showError(
      `Failed to list environments: ${error.message}`,
      'List Failed'
    );
    process.exit(1);
  }
}

/**
 * Get environments from EnvFly cloud service
 */
async function getEnvFlyEnvironments(config) {
  try {
    // Check authentication
    const isAuthenticated = await authManager.checkAuth();
    if (!isAuthenticated) {
      return [];
    }

    // Initialize API client
    await apiClient.initialize();

    // Get project environments
    const environments = await apiClient.getProjectEnvironments(config.project_id);
    return environments || [];

  } catch (error) {
    console.log(chalk.yellow(`⚠ Could not fetch remote environments: ${error.message}`));
    return [];
  }
}

/**
 * Get environments from custom storage provider
 */
async function getStorageProviderEnvironments(config) {
  try {
    const provider = await StorageProviderFactory.create(config.storage.provider, config.storage.config);
    const environments = await provider.list();
    return environments || [];

  } catch (error) {
    console.log(chalk.yellow(`⚠ Could not fetch remote environments: ${error.message}`));
    return [];
  }
}

/**
 * Get local environments
 */
async function getLocalEnvironments(config) {
  const localEnvs = [];

  for (const [envName, envConfig] of Object.entries(config.environments)) {
    try {
      const filePath = envParser.getEnvFilePath(envName, config);
      const exists = await require('fs-extra').pathExists(filePath);
      
      if (exists) {
        const env = await envParser.readEnvFile(filePath);
        const stats = await require('fs-extra').stat(filePath);
        
        localEnvs.push({
          name: envName,
          file: envConfig.file,
          description: envConfig.description,
          variables: Object.keys(env).length,
          file_size: stats.size,
          last_modified: stats.mtime,
          last_sync: envConfig.last_sync,
          last_push: envConfig.last_push,
          last_pull: envConfig.last_pull,
          remote_id: envConfig.remote_id
        });
      } else {
        localEnvs.push({
          name: envName,
          file: envConfig.file,
          description: envConfig.description,
          variables: 0,
          file_size: 0,
          exists: false,
          last_sync: envConfig.last_sync,
          last_push: envConfig.last_push,
          last_pull: envConfig.last_pull,
          remote_id: envConfig.remote_id
        });
      }
    } catch (error) {
      localEnvs.push({
        name: envName,
        file: envConfig.file,
        description: envConfig.description,
        error: error.message,
        last_sync: envConfig.last_sync,
        last_push: envConfig.last_push,
        last_pull: envConfig.last_pull,
        remote_id: envConfig.remote_id
      });
    }
  }

  return localEnvs;
}

/**
 * Display environments in a formatted table
 */
function displayEnvironments(config, localEnvironments, remoteEnvironments) {
  console.log(chalk.blue('\n📋 Environment Overview'));
  console.log(chalk.gray('─'.repeat(80)));

  // Project information
  console.log(chalk.bold(`Project: ${config.project_name}`));
  console.log(chalk.gray(`Project ID: ${config.project_id}`));
  
  if (config.team_name) {
    console.log(chalk.gray(`Team: ${config.team_name}`));
  }
  
  const storageProvider = config.storage?.provider || 'envfly';
  console.log(chalk.gray(`Storage: ${getStorageProviderName(storageProvider)}`));
  
  console.log(chalk.gray('─'.repeat(80)));

  if (localEnvironments.length === 0) {
    console.log(chalk.yellow('\nNo environments configured.'));
    console.log(chalk.gray('Run "envfly init" to set up environments.'));
    return;
  }

  // Environment table header
  console.log(chalk.bold('\nEnvironment'));
  console.log(chalk.gray('─'.repeat(80)));
  console.log(
    chalk.bold(
      'Name'.padEnd(15) +
      'File'.padEnd(20) +
      'Variables'.padEnd(10) +
      'Size'.padEnd(10) +
      'Last Sync'.padEnd(15) +
      'Status'.padEnd(10)
    )
  );
  console.log(chalk.gray('─'.repeat(80)));

  // Display each environment
  for (const localEnv of localEnvironments) {
    const remoteEnv = remoteEnvironments.find(r => r.name === localEnv.name);
    
    // Environment name
    let name = localEnv.name.padEnd(15);
    
    // File name
    let file = (localEnv.file || 'N/A').padEnd(20);
    
    // Variable count
    let variables = localEnv.variables ? localEnv.variables.toString().padEnd(10) : '0'.padEnd(10);
    
    // File size
    let size = localEnv.file_size ? formatFileSize(localEnv.file_size).padEnd(10) : 'N/A'.padEnd(10);
    
    // Last sync time
    let lastSync = 'Never'.padEnd(15);
    if (localEnv.last_sync) {
      lastSync = formatDate(localEnv.last_sync).padEnd(15);
    } else if (localEnv.last_push) {
      lastSync = `Pushed ${formatDate(localEnv.last_push)}`.padEnd(15);
    } else if (localEnv.last_pull) {
      lastSync = `Pulled ${formatDate(localEnv.last_pull)}`.padEnd(15);
    }
    
    // Status
    let status = '';
    if (localEnv.error) {
      status = chalk.red('Error');
    } else if (!localEnv.exists) {
      status = chalk.yellow('Missing');
    } else if (remoteEnv) {
      if (localEnv.last_sync && remoteEnv.metadata?.updated_at) {
        const localTime = new Date(localEnv.last_sync).getTime();
        const remoteTime = new Date(remoteEnv.metadata.updated_at).getTime();
        
        if (localTime < remoteTime) {
          status = chalk.yellow('Outdated');
        } else {
          status = chalk.green('Synced');
        }
      } else {
        status = chalk.blue('Local');
      }
    } else {
      status = chalk.blue('Local');
    }
    
    status = status.padEnd(10);
    
    // Print row
    console.log(name + file + variables + size + lastSync + status);
  }

  console.log(chalk.gray('─'.repeat(80)));

  // Summary
  const totalEnvironments = localEnvironments.length;
  const existingEnvironments = localEnvironments.filter(e => e.exists && !e.error).length;
  const syncedEnvironments = localEnvironments.filter(e => e.last_sync).length;
  const totalVariables = localEnvironments.reduce((sum, e) => sum + (e.variables || 0), 0);

  console.log(chalk.blue('\n📊 Summary'));
  console.log(chalk.gray('─'.repeat(40)));
  console.log(`Total environments: ${chalk.bold(totalEnvironments)}`);
  console.log(`Existing files: ${chalk.bold(existingEnvironments)}`);
  console.log(`Synced environments: ${chalk.bold(syncedEnvironments)}`);
  console.log(`Total variables: ${chalk.bold(totalVariables)}`);

  // Remote environments summary
  if (remoteEnvironments.length > 0) {
    console.log(chalk.blue('\n🌐 Remote Environments'));
    console.log(chalk.gray('─'.repeat(40)));
    
    for (const remoteEnv of remoteEnvironments) {
      const localEnv = localEnvironments.find(l => l.name === remoteEnv.name);
      const status = localEnv ? 'Connected' : 'Remote only';
      const color = localEnv ? chalk.green : chalk.yellow;
      
      console.log(`${remoteEnv.name}: ${color(status)}`);
      if (remoteEnv.metadata?.updated_at) {
        console.log(chalk.gray(`  Last updated: ${formatDate(remoteEnv.metadata.updated_at)}`));
      }
    }
  }

  // Next steps
  console.log(chalk.blue('\n🚀 Next Steps'));
  console.log(chalk.gray('─'.repeat(40)));
  console.log(`• Run ${chalk.cyan('envfly sync <environment>')} to sync an environment`);
  console.log(`• Run ${chalk.cyan('envfly push <environment>')} to store environment variables`);
  console.log(`• Run ${chalk.cyan('envfly pull <environment>')} to retrieve environment variables`);
  
  if (storageProvider === 'envfly' && config.team_id) {
    console.log(`• Run ${chalk.cyan('envfly team members')} to manage team members`);
  }
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

module.exports = list; 