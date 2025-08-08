const chalk = require('chalk');
const { program } = require('commander');

// Import all commands
const init = require('./commands/init');
const login = require('./commands/login');
const sync = require('./commands/sync');
const push = require('./commands/push');
const pull = require('./commands/pull');
const list = require('./commands/list');

// Import utilities
const { checkAuth } = require('./lib/auth');
const { loadConfig } = require('./lib/config');

class EnvFlyCLI {
  constructor() {
    this.config = null;
    this.isAuthenticated = false;
  }

  async initialize() {
    try {
      // Load configuration if it exists
      this.config = await loadConfig();
      
      // Check authentication if config exists
      if (this.config) {
        this.isAuthenticated = await checkAuth();
      }
    } catch (error) {
      // Config doesn't exist or other error - this is normal for init/login commands
    }
  }

  async run() {
    await this.initialize();
    
    // Set up global error handler
    process.on('unhandledRejection', (error) => {
      console.error(chalk.red('Unhandled error:'), error.message);
      process.exit(1);
    });

    process.on('uncaughtException', (error) => {
      console.error(chalk.red('Uncaught error:'), error.message);
      process.exit(1);
    });
  }
}

module.exports = EnvFlyCLI; 