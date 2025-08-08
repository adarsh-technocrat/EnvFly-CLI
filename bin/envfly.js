#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const { version } = require('../package.json');

// Import commands
const initCmd = require('../src/commands/init');
const loginCmd = require('../src/commands/login');
const syncCmd = require('../src/commands/sync');
const pushCmd = require('../src/commands/push');
const pullCmd = require('../src/commands/pull');
const listCmd = require('../src/commands/list');
const teamCmd = require('../src/commands/team');
const historyCmd = require('../src/commands/history');
const auditCmd = require('../src/commands/audit');

program
  .name('envfly')
  .description('Sync environment variables across teams and projects')
  .version(version);

// Commands
program
  .command('init')
  .description('Initialize EnvFly in current project')
  .action(initCmd);

program
  .command('login')
  .description('Authenticate with EnvFly')
  .action(loginCmd);

program
  .command('sync <environment>')
  .description('Sync specific environment')
  .option('-f, --force', 'Force sync without confirmation')
  .option('--all', 'Sync all environments')
  .action(syncCmd);

program
  .command('push <environment>')
  .description('Push local .env to remote')
  .action(pushCmd);

program
  .command('pull <environment>')
  .description('Pull remote environment to local')
  .action(pullCmd);

program
  .command('list')
  .description('List available environments')
  .alias('ls')
  .action(listCmd);

// Team management commands
program
  .command('team')
  .description('Team management commands')
  .action(teamCmd);

// History and audit commands
program
  .command('history <environment>')
  .description('Show environment version history')
  .action(historyCmd);

program
  .command('audit <environment>')
  .description('Show environment audit logs')
  .action(auditCmd);

// Parse arguments
program.parse(); 