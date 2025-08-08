const inquirer = require('inquirer');
const chalk = require('chalk');
const { configManager } = require('../lib/config');
const { authManager } = require('../lib/auth');
const { apiClient } = require('../lib/api');
const { showSuccess, showError, showInfo, createSpinner, formatDate } = require('../lib/utils');

async function team() {
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

    // Get command arguments
    const args = process.argv.slice(3);
    const subcommand = args[0];

    switch (subcommand) {
      case 'create':
        await createTeam(args[1]);
        break;
      case 'list':
        await listTeams();
        break;
      case 'invite':
        await inviteMember(args[1], args[2]);
        break;
      case 'join':
        await joinTeam(args[1]);
        break;
      case 'members':
        await listTeamMembers(args[1]);
        break;
      case 'grant':
        await grantPermission(args[1], args[2], args[3], args[4]);
        break;
      case 'share-env':
        await shareEnvironment(args[1], args[2], args[3], args[4]);
        break;
      default:
        showError(
          `Unknown team command: ${subcommand}\n\n` +
          `Available commands:\n` +
          `  envfly team create <name>     - Create new team\n` +
          `  envfly team list              - List your teams\n` +
          `  envfly team invite <email>    - Invite member to team\n` +
          `  envfly team join <code>       - Join team via invite code\n` +
          `  envfly team members <team>    - List team members\n` +
          `  envfly team grant <user> <env> - Grant environment access\n` +
          `  envfly team share-env <env>   - Share environment with team`,
          'Invalid Command'
        );
        process.exit(1);
    }

  } catch (error) {
    showError(
      `Team command failed: ${error.message}`,
      'Team Command Failed'
    );
    process.exit(1);
  }
}

/**
 * Create a new team
 */
async function createTeam(teamName) {
  if (!teamName) {
    showError(
      'Team name is required. Use: envfly team create <team-name>',
      'Team Name Required'
    );
    process.exit(1);
  }

  const spinner = createSpinner('Creating team...');
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

  } catch (error) {
    spinner.fail('Failed to create team');
    throw error;
  }
}

/**
 * List user's teams
 */
async function listTeams() {
  const spinner = createSpinner('Fetching teams...');
  spinner.start();

  try {
    const teams = await apiClient.getUserTeams();
    spinner.succeed('Teams loaded');

    if (teams.length === 0) {
      showInfo(
        'You are not a member of any teams yet.\n\n' +
        'Create a team: envfly team create <team-name>\n' +
        'Join a team: envfly team join <invite-code>',
        'No Teams Found'
      );
      return;
    }

    console.log(chalk.blue('\n📋 Your Teams'));
    console.log(chalk.gray('─'.repeat(80)));

    for (const team of teams) {
      console.log(`${chalk.bold(team.name)}`);
      console.log(`  ID: ${team.id}`);
      console.log(`  Role: ${chalk.cyan(team.role)}`);
      console.log(`  Members: ${team.member_count}`);
      console.log(`  Projects: ${team.project_count}`);
      console.log(`  Created: ${formatDate(team.created_at)}`);
      console.log('');
    }

  } catch (error) {
    spinner.fail('Failed to fetch teams');
    throw error;
  }
}

/**
 * Invite member to team
 */
async function inviteMember(email, role = 'developer') {
  if (!email) {
    showError(
      'Email is required. Use: envfly team invite <email> [role]',
      'Email Required'
    );
    process.exit(1);
  }

  // Get current team from config
  const config = await configManager.loadConfig();
  if (!config.team_id) {
    showError(
      'No team selected. Please run "envfly init" to set up a team.',
      'No Team Selected'
    );
    process.exit(1);
  }

  const spinner = createSpinner(`Inviting ${email}...`);
  spinner.start();

  try {
    const inviteData = {
      email,
      role,
      team_id: config.team_id
    };

    const invite = await apiClient.inviteTeamMember(inviteData);
    spinner.succeed('Invitation sent');

    showSuccess(
      `Invitation sent to ${chalk.bold(email)}!\n\n` +
      `Role: ${chalk.bold(role)}\n` +
      `Team: ${chalk.bold(config.team_name || config.team_id)}\n` +
      `Invite Code: ${chalk.bold(invite.code)}\n\n` +
      `They can join using:\n` +
      `${chalk.cyan(`envfly team join ${invite.code}`)}`,
      'Invitation Sent'
    );

  } catch (error) {
    spinner.fail('Failed to send invitation');
    throw error;
  }
}

/**
 * Join team via invite code
 */
async function joinTeam(inviteCode) {
  if (!inviteCode) {
    showError(
      'Invite code is required. Use: envfly team join <invite-code>',
      'Invite Code Required'
    );
    process.exit(1);
  }

  const spinner = createSpinner('Joining team...');
  spinner.start();

  try {
    const joinData = {
      invite_code: inviteCode
    };

    const team = await apiClient.joinTeam(joinData);
    spinner.succeed('Successfully joined team');

    showSuccess(
      `Successfully joined ${chalk.bold(team.name)}!\n\n` +
      `Team ID: ${chalk.bold(team.id)}\n` +
      `Your Role: ${chalk.bold(team.role)}\n` +
      `Member Count: ${chalk.bold(team.member_count)}\n\n` +
      `You can now access team environments:\n` +
      `${chalk.cyan('envfly list')} - List available environments\n` +
      `${chalk.cyan('envfly sync <env>')} - Sync environments`,
      'Team Joined'
    );

  } catch (error) {
    spinner.fail('Failed to join team');
    throw error;
  }
}

/**
 * List team members
 */
async function listTeamMembers(teamId) {
  if (!teamId) {
    // Use current team from config
    const config = await configManager.loadConfig();
    teamId = config.team_id;
    
    if (!teamId) {
      showError(
        'No team specified. Use: envfly team members <team-id>',
        'Team ID Required'
      );
      process.exit(1);
    }
  }

  const spinner = createSpinner('Fetching team members...');
  spinner.start();

  try {
    const members = await apiClient.getTeamMembers(teamId);
    spinner.succeed('Team members loaded');

    console.log(chalk.blue('\n👥 Team Members'));
    console.log(chalk.gray('─'.repeat(80)));

    for (const member of members) {
      const status = member.status === 'active' ? 
        chalk.green('✓') : chalk.red('✗');
      
      console.log(`${status} ${chalk.bold(member.name)} (${member.email})`);
      console.log(`  Role: ${chalk.cyan(member.role)}`);
      console.log(`  Joined: ${formatDate(member.joined_at)}`);
      console.log(`  Status: ${member.status}`);
      console.log('');
    }

  } catch (error) {
    spinner.fail('Failed to fetch team members');
    throw error;
  }
}

/**
 * Grant environment access to user
 */
async function grantPermission(userEmail, environment, permission = 'read') {
  if (!userEmail || !environment) {
    showError(
      'User email and environment are required. Use: envfly team grant <email> <environment> [permission]',
      'Parameters Required'
    );
    process.exit(1);
  }

  const config = await configManager.loadConfig();
  const envConfig = config.environments[environment];
  
  if (!envConfig || !envConfig.remote_id) {
    showError(
      `Environment "${environment}" not found or not connected to remote.`,
      'Environment Not Found'
    );
    process.exit(1);
  }

  const spinner = createSpinner(`Granting ${permission} access to ${environment}...`);
  spinner.start();

  try {
    const permissionData = {
      user_email: userEmail,
      environment_id: envConfig.remote_id,
      permission: permission
    };

    await apiClient.grantEnvironmentAccess(permissionData);
    spinner.succeed('Permission granted');

    showSuccess(
      `Granted ${chalk.bold(permission)} access to ${chalk.bold(userEmail)} for ${chalk.bold(environment)}!\n\n` +
      `They can now access this environment using:\n` +
      `${chalk.cyan(`envfly pull ${environment}`)}`,
      'Permission Granted'
    );

  } catch (error) {
    spinner.fail('Failed to grant permission');
    throw error;
  }
}

/**
 * Share environment with another team
 */
async function shareEnvironment(environment, targetTeam, keys = null) {
  if (!environment || !targetTeam) {
    showError(
      'Environment and target team are required. Use: envfly team share-env <environment> <team> [keys]',
      'Parameters Required'
    );
    process.exit(1);
  }

  const config = await configManager.loadConfig();
  const envConfig = config.environments[environment];
  
  if (!envConfig || !envConfig.remote_id) {
    showError(
      `Environment "${environment}" not found or not connected to remote.`,
      'Environment Not Found'
    );
    process.exit(1);
  }

  const spinner = createSpinner(`Sharing ${environment} with ${targetTeam}...`);
  spinner.start();

  try {
    const shareData = {
      environment_id: envConfig.remote_id,
      target_team: targetTeam,
      shared_keys: keys ? keys.split(',') : null
    };

    const share = await apiClient.shareEnvironment(shareData);
    spinner.succeed('Environment shared');

    showSuccess(
      `Successfully shared ${chalk.bold(environment)} with ${chalk.bold(targetTeam)}!\n\n` +
      `Shared Keys: ${keys || 'All variables'}\n` +
      `Share ID: ${chalk.bold(share.id)}\n\n` +
      `Team members can access using:\n` +
      `${chalk.cyan(`envfly pull shared/${environment}`)}`,
      'Environment Shared'
    );

  } catch (error) {
    spinner.fail('Failed to share environment');
    throw error;
  }
}

module.exports = team; 