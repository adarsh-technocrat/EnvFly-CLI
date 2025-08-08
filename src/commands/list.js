const chalk = require('chalk');
const { configManager } = require('../lib/config');
const { authManager } = require('../lib/auth');
const { apiClient } = require('../lib/api');
const { envParser } = require('../lib/env-parser');
const { showSuccess, showError, showInfo, createSpinner, formatDate, createTableHeader, createTableRow } = require('../lib/utils');

async function list() {
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

    await listEnvironments(config);

  } catch (error) {
    showError(
      `List failed: ${error.message}`,
      'List Failed'
    );
    process.exit(1);
  }
}

/**
 * List all environments
 */
async function listEnvironments(config) {
  const spinner = createSpinner('Fetching environment information...');
  spinner.start();

  try {
    // Get local environment information
    const localEnvs = await getLocalEnvironmentInfo(config);
    
    // Get remote environment information
    const remoteEnvs = await getRemoteEnvironmentInfo(config);

    spinner.succeed('Environment information loaded');

    // Display project information
    showProjectInfo(config);

    // Display environments table
    displayEnvironmentsTable(config, localEnvs, remoteEnvs);

    // Show summary
    showEnvironmentSummary(config, localEnvs, remoteEnvs);

  } catch (error) {
    spinner.fail('Failed to fetch environment information');
    throw error;
  }
}

/**
 * Get local environment information
 */
async function getLocalEnvironmentInfo(config) {
  const localEnvs = {};

  for (const [envName, envConfig] of Object.entries(config.environments)) {
    const localFilePath = envParser.getEnvFilePath(envName, config);
    
    try {
      const localEnv = await envParser.readEnvFile(localFilePath);
      localEnvs[envName] = {
        exists: true,
        variableCount: Object.keys(localEnv).length,
        fileSize: require('fs').statSync(localFilePath).size,
        lastModified: require('fs').statSync(localFilePath).mtime
      };
    } catch (error) {
      localEnvs[envName] = {
        exists: false,
        variableCount: 0,
        fileSize: 0,
        lastModified: null
      };
    }
  }

  return localEnvs;
}

/**
 * Get remote environment information
 */
async function getRemoteEnvironmentInfo(config) {
  const remoteEnvs = {};

  for (const [envName, envConfig] of Object.entries(config.environments)) {
    if (envConfig.remote_id) {
      try {
        const remoteData = await apiClient.getEnvironment(config.project_id, envConfig.remote_id);
        remoteEnvs[envName] = {
          exists: true,
          variableCount: remoteData.variables ? Object.keys(remoteData.variables).length : 0,
          lastModified: remoteData.updated_at || remoteData.created_at,
          encrypted: remoteData.encrypted || false,
          description: remoteData.description || envConfig.description
        };
      } catch (error) {
        remoteEnvs[envName] = {
          exists: false,
          error: error.message
        };
      }
    } else {
      remoteEnvs[envName] = {
        exists: false,
        variableCount: 0,
        lastModified: null,
        encrypted: false
      };
    }
  }

  return remoteEnvs;
}

/**
 * Show project information
 */
function showProjectInfo(config) {
  console.log(chalk.blue('\n📁 Project Information'));
  console.log(chalk.gray('─'.repeat(50)));
  console.log(`${chalk.bold('Project:')} ${config.project_name}`);
  console.log(`${chalk.bold('Project ID:')} ${config.project_id}`);
  console.log(`${chalk.bold('Team ID:')} ${config.team_id}`);
  console.log(`${chalk.bold('Environments:')} ${Object.keys(config.environments).length}`);
  console.log(`${chalk.bold('Encryption:')} ${config.auth.encryption.enabled ? 'Enabled' : 'Disabled'}`);
}

/**
 * Display environments table
 */
function displayEnvironmentsTable(config, localEnvs, remoteEnvs) {
  console.log(chalk.blue('\n🌍 Environments'));
  console.log(chalk.gray('─'.repeat(100)));

  // Table header
  const header = createTableHeader('Environment', 'Local', 'Remote', 'Variables', 'Last Sync', 'Status');
  console.log(header);

  // Table rows
  for (const [envName, envConfig] of Object.entries(config.environments)) {
    const local = localEnvs[envName];
    const remote = remoteEnvs[envName];
    
    const localStatus = local.exists ? 
      chalk.green('✓') : 
      chalk.red('✗');
    
    const remoteStatus = remote.exists ? 
      chalk.green('✓') : 
      chalk.red('✗');
    
    const localInfo = local.exists ? 
      `${local.variableCount} vars` : 
      'Not found';
    
    const remoteInfo = remote.exists ? 
      `${remote.variableCount} vars` : 
      'Not connected';
    
    const lastSync = envConfig.last_sync ? 
      formatDate(envConfig.last_sync) : 
      'Never';
    
    const status = getEnvironmentStatus(local, remote, envConfig);
    
    const row = createTableRow(
      envName,
      `${localStatus} ${localInfo}`,
      `${remoteStatus} ${remoteInfo}`,
      `${local.variableCount}/${remote.variableCount}`,
      lastSync,
      status
    );
    
    console.log(row);
  }
}

/**
 * Get environment status
 */
function getEnvironmentStatus(local, remote, envConfig) {
  if (!local.exists && !remote.exists) {
    return chalk.red('Not initialized');
  }
  
  if (!local.exists && remote.exists) {
    return chalk.yellow('Local missing');
  }
  
  if (local.exists && !remote.exists) {
    return chalk.yellow('Remote missing');
  }
  
  if (local.exists && remote.exists) {
    if (local.variableCount === remote.variableCount) {
      return chalk.green('In sync');
    } else {
      return chalk.yellow('Out of sync');
    }
  }
  
  return chalk.gray('Unknown');
}

/**
 * Show environment summary
 */
function showEnvironmentSummary(config, localEnvs, remoteEnvs) {
  const totalEnvs = Object.keys(config.environments).length;
  const localExists = Object.values(localEnvs).filter(env => env.exists).length;
  const remoteExists = Object.values(remoteEnvs).filter(env => env.exists).length;
  const inSync = Object.keys(config.environments).filter(envName => {
    const local = localEnvs[envName];
    const remote = remoteEnvs[envName];
    return local.exists && remote.exists && local.variableCount === remote.variableCount;
  }).length;

  console.log(chalk.blue('\n📊 Summary'));
  console.log(chalk.gray('─'.repeat(50)));
  console.log(`${chalk.bold('Total environments:')} ${totalEnvs}`);
  console.log(`${chalk.bold('Local files:')} ${localExists}/${totalEnvs}`);
  console.log(`${chalk.bold('Remote environments:')} ${remoteExists}/${totalEnvs}`);
  console.log(`${chalk.bold('In sync:')} ${inSync}/${totalEnvs}`);

  // Show next steps
  console.log(chalk.blue('\n🚀 Next Steps'));
  console.log(chalk.gray('─'.repeat(50)));
  
  if (inSync < totalEnvs) {
    console.log(`• Run ${chalk.cyan('envfly sync <environment>')} to sync out-of-sync environments`);
  }
  
  if (localExists < totalEnvs) {
    console.log(`• Run ${chalk.cyan('envfly pull <environment>')} to download missing local files`);
  }
  
  if (remoteExists < totalEnvs) {
    console.log(`• Run ${chalk.cyan('envfly push <environment>')} to create missing remote environments`);
  }
  
  if (inSync === totalEnvs) {
    console.log(`• All environments are in sync! 🎉`);
  }
}

module.exports = list; 