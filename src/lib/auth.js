const keytar = require('keytar');
const axios = require('axios');
const chalk = require('chalk');
const { configManager } = require('./config');

const SERVICE_NAME = 'envfly-cli';
const ACCOUNT_NAME = 'api-key';

class AuthManager {
  constructor() {
    this.apiKey = null;
    this.isAuthenticated = false;
  }

  /**
   * Store API key securely
   */
  async storeApiKey(apiKey) {
    try {
      await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, apiKey);
      this.apiKey = apiKey;
      this.isAuthenticated = true;
      return true;
    } catch (error) {
      throw new Error(`Failed to store API key: ${error.message}`);
    }
  }

  /**
   * Retrieve stored API key
   */
  async getApiKey() {
    try {
      if (this.apiKey) {
        return this.apiKey;
      }

      const storedKey = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
      if (storedKey) {
        this.apiKey = storedKey;
        return storedKey;
      }

      return null;
    } catch (error) {
      console.warn(chalk.yellow('Warning: Could not retrieve stored API key'));
      return null;
    }
  }

  /**
   * Remove stored API key
   */
  async removeApiKey() {
    try {
      await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
      this.apiKey = null;
      this.isAuthenticated = false;
      return true;
    } catch (error) {
      throw new Error(`Failed to remove API key: ${error.message}`);
    }
  }

  /**
   * Check if user is authenticated
   */
  async checkAuth() {
    try {
      const apiKey = await this.getApiKey();
      if (!apiKey) {
        return false;
      }

      // Validate API key with server
      const config = await configManager.loadConfig();
      const response = await axios.get(`${config.auth.endpoint}/auth/validate`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      this.isAuthenticated = response.status === 200;
      return this.isAuthenticated;
    } catch (error) {
      if (error.response && error.response.status === 401) {
        // Invalid API key, remove it
        await this.removeApiKey();
        return false;
      }
      
      // Network error or other issue
      console.warn(chalk.yellow('Warning: Could not validate authentication'));
      return false;
    }
  }

  /**
   * Get authentication headers for API requests
   */
  async getAuthHeaders() {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      throw new Error('No API key found. Please run "envfly login" to authenticate.');
    }

    return {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Login with API key
   */
  async login(apiKey) {
    try {
      // Validate API key with server
      const config = await configManager.loadConfig();
      const response = await axios.get(`${config.auth.endpoint}/auth/validate`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.status === 200) {
        // Store the valid API key
        await this.storeApiKey(apiKey);
        return true;
      } else {
        throw new Error('Invalid API key');
      }
    } catch (error) {
      if (error.response && error.response.status === 401) {
        throw new Error('Invalid API key. Please check your credentials.');
      }
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        throw new Error('Could not connect to EnvFly server. Please check your internet connection.');
      }
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  /**
   * Logout user
   */
  async logout() {
    try {
      await this.removeApiKey();
      return true;
    } catch (error) {
      throw new Error(`Logout failed: ${error.message}`);
    }
  }

  /**
   * Check if keytar is available
   */
  async isKeytarAvailable() {
    try {
      // Try to access keytar
      await keytar.findCredentials(SERVICE_NAME);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get authentication status
   */
  getAuthStatus() {
    return {
      isAuthenticated: this.isAuthenticated,
      hasApiKey: !!this.apiKey
    };
  }
}

// Create singleton instance
const authManager = new AuthManager();

// Export functions for backward compatibility
const checkAuth = () => authManager.checkAuth();
const getAuthHeaders = () => authManager.getAuthHeaders();
const login = (apiKey) => authManager.login(apiKey);
const logout = () => authManager.logout();
const storeApiKey = (apiKey) => authManager.storeApiKey(apiKey);
const getApiKey = () => authManager.getApiKey();
const removeApiKey = () => authManager.removeApiKey();

module.exports = {
  AuthManager,
  authManager,
  checkAuth,
  getAuthHeaders,
  login,
  logout,
  storeApiKey,
  getApiKey,
  removeApiKey
}; 