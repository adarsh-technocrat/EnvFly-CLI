const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { getDefaultConfig } = require('../templates/envfly-template');

class ConfigManager {
  constructor() {
    this.configPath = path.join(process.cwd(), '.envfly');
    this.config = null;
  }

  /**
   * Load configuration from .envfly file
   */
  async loadConfig() {
    try {
      if (!await fs.pathExists(this.configPath)) {
        throw new Error('Configuration file not found. Run "envfly init" to initialize.');
      }

      const configData = await fs.readFile(this.configPath, 'utf8');
      this.config = JSON.parse(configData);
      
      // Validate config structure
      this.validateConfig(this.config);
      
      return this.config;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error('Configuration file not found. Run "envfly init" to initialize.');
      }
      if (error instanceof SyntaxError) {
        throw new Error('Invalid configuration file format. Please check your .envfly file.');
      }
      throw error;
    }
  }

  /**
   * Save configuration to .envfly file
   */
  async saveConfig(config) {
    try {
      // Validate before saving
      this.validateConfig(config);
      
      await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
      this.config = config;
    } catch (error) {
      throw new Error(`Failed to save configuration: ${error.message}`);
    }
  }

  /**
   * Create new configuration file
   */
  async createConfig(projectName, teamId) {
    const config = getDefaultConfig(projectName, teamId);
    await this.saveConfig(config);
    return config;
  }

  /**
   * Check if configuration exists
   */
  async configExists() {
    return await fs.pathExists(this.configPath);
  }

  /**
   * Get environment configuration
   */
  getEnvironment(envName) {
    if (!this.config || !this.config.environments) {
      throw new Error('No configuration loaded');
    }
    
    const env = this.config.environments[envName];
    if (!env) {
      throw new Error(`Environment "${envName}" not found in configuration`);
    }
    
    return env;
  }

  /**
   * List all environments
   */
  listEnvironments() {
    if (!this.config || !this.config.environments) {
      return [];
    }
    
    return Object.keys(this.config.environments).map(name => ({
      name,
      ...this.config.environments[name]
    }));
  }

  /**
   * Add new environment
   */
  addEnvironment(name, config) {
    if (!this.config.environments) {
      this.config.environments = {};
    }
    
    this.config.environments[name] = {
      remote_id: null,
      description: config.description || '',
      file: config.file || `.env.${name}`,
      ...config
    };
  }

  /**
   * Update environment
   */
  updateEnvironment(name, updates) {
    if (!this.config.environments || !this.config.environments[name]) {
      throw new Error(`Environment "${name}" not found`);
    }
    
    this.config.environments[name] = {
      ...this.config.environments[name],
      ...updates
    };
  }

  /**
   * Remove environment
   */
  removeEnvironment(name) {
    if (!this.config.environments || !this.config.environments[name]) {
      throw new Error(`Environment "${name}" not found`);
    }
    
    delete this.config.environments[name];
  }

  /**
   * Validate configuration structure
   */
  validateConfig(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('Invalid configuration: must be an object');
    }

    if (!config.version) {
      throw new Error('Invalid configuration: missing version');
    }

    if (!config.project_id) {
      throw new Error('Invalid configuration: missing project_id');
    }

    if (!config.project_name) {
      throw new Error('Invalid configuration: missing project_name');
    }

    if (!config.team_id) {
      throw new Error('Invalid configuration: missing team_id');
    }

    if (!config.environments || typeof config.environments !== 'object') {
      throw new Error('Invalid configuration: missing or invalid environments');
    }

    if (!config.auth || typeof config.auth !== 'object') {
      throw new Error('Invalid configuration: missing or invalid auth section');
    }
  }

  /**
   * Get configuration path
   */
  getConfigPath() {
    return this.configPath;
  }

  /**
   * Get project root directory
   */
  getProjectRoot() {
    return process.cwd();
  }
}

// Create singleton instance
const configManager = new ConfigManager();

// Export functions for backward compatibility
const loadConfig = () => configManager.loadConfig();
const saveConfig = (config) => configManager.saveConfig(config);
const createConfig = (projectName, teamId) => configManager.createConfig(projectName, teamId);
const configExists = () => configManager.configExists();
const getEnvironment = (envName) => configManager.getEnvironment(envName);
const listEnvironments = () => configManager.listEnvironments();

module.exports = {
  ConfigManager,
  configManager,
  loadConfig,
  saveConfig,
  createConfig,
  configExists,
  getEnvironment,
  listEnvironments
}; 