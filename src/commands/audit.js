const chalk = require('chalk');
const { configManager } = require('../lib/config');
const { authManager } = require('../lib/auth');
const { apiClient } = require('../lib/api');
const { showSuccess, showError, showInfo, createSpinner, formatDate } = require('../lib/utils');

async function audit(environment) {
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
        'Environment name is required. Use "envfly audit <environment>"',
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

    await showEnvironmentAudit(environment, envConfig, config);

  } catch (error) {
    showError(
      `Audit command failed: ${error.message}`,
      'Audit Failed'
    );
    process.exit(1);
  }
}

/**
 * Show environment audit logs
 */
async function showEnvironmentAudit(envName, envConfig, config) {
  const spinner = createSpinner(`Fetching audit logs for ${envName}...`);
  spinner.start();

  try {
    const auditLogs = await apiClient.getEnvironmentAudit(config.project_id, envConfig.remote_id);
    spinner.succeed('Audit logs loaded');

    if (auditLogs.length === 0) {
      showInfo(
        `No audit logs available for ${envName}.\n\n` +
        `This environment hasn't been modified yet.`,
        'No Audit Logs'
      );
      return;
    }

    console.log(chalk.blue(`\n📋 Audit Logs for ${envName}`));
    console.log(chalk.gray('─'.repeat(80)));

    for (const log of auditLogs) {
      const actionIcon = getActionIcon(log.action);
      const actionColor = getActionColor(log.action);
      
      console.log(`${actionIcon} ${actionColor(log.action.toUpperCase())} - ${formatDate(log.timestamp)}`);
      console.log(`  User: ${chalk.cyan(log.user_name)} (${log.user_email})`);
      console.log(`  IP: ${chalk.gray(log.ip_address)}`);
      console.log(`  User Agent: ${chalk.gray(log.user_agent)}`);
      
      if (log.details) {
        console.log(`  Details:`);
        if (log.details.variables_changed) {
          log.details.variables_changed.forEach(change => {
            const symbol = change.type === 'added' ? chalk.green('+') : 
                          change.type === 'removed' ? chalk.red('-') : 
                          chalk.yellow('~');
            console.log(`    ${symbol} ${change.key}${change.old_value ? ` (${change.old_value} → ${change.new_value})` : ''}`);
          });
        }
        
        if (log.details.metadata) {
          console.log(`  Metadata: ${JSON.stringify(log.details.metadata)}`);
        }
      }
      
      if (log.message) {
        console.log(`  Message: ${log.message}`);
      }
      
      console.log('');
    }

    // Show summary
    const summary = {
      total: auditLogs.length,
      byAction: {},
      byUser: {}
    };

    auditLogs.forEach(log => {
      summary.byAction[log.action] = (summary.byAction[log.action] || 0) + 1;
      summary.byUser[log.user_email] = (summary.byUser[log.user_email] || 0) + 1;
    });

    console.log(chalk.blue('\n📊 Summary'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(`Total actions: ${chalk.bold(summary.total)}`);
    
    console.log('\nBy action:');
    Object.entries(summary.byAction).forEach(([action, count]) => {
      console.log(`  ${getActionColor(action)(action)}: ${chalk.bold(count)}`);
    });
    
    console.log('\nBy user:');
    Object.entries(summary.byUser).forEach(([user, count]) => {
      console.log(`  ${chalk.cyan(user)}: ${chalk.bold(count)}`);
    });

  } catch (error) {
    spinner.fail(`Failed to fetch audit logs for ${envName}`);
    throw error;
  }
}

/**
 * Get action icon
 */
function getActionIcon(action) {
  const icons = {
    'create': '📝',
    'update': '✏️',
    'delete': '🗑️',
    'pull': '⬇️',
    'push': '⬆️',
    'sync': '🔄',
    'rollback': '⏪',
    'share': '📤',
    'grant': '🔑',
    'revoke': '🚫'
  };
  return icons[action] || '📋';
}

/**
 * Get action color
 */
function getActionColor(action) {
  const colors = {
    'create': chalk.green,
    'update': chalk.blue,
    'delete': chalk.red,
    'pull': chalk.cyan,
    'push': chalk.magenta,
    'sync': chalk.yellow,
    'rollback': chalk.orange,
    'share': chalk.purple,
    'grant': chalk.green,
    'revoke': chalk.red
  };
  return colors[action] || chalk.white;
}

module.exports = audit; 