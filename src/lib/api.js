const axios = require('axios');
const chalk = require('chalk');
const { authManager } = require('./auth');
const { configManager } = require('./config');

class ApiClient {
  constructor() {
    this.baseURL = null;
    this.client = null;
    this.retryAttempts = 3;
    this.retryDelay = 1000;
  }

  /**
   * Initialize API client with configuration
   */
  async initialize() {
    try {
      const config = await configManager.loadConfig();
      this.baseURL = config.auth.endpoint;
      
      this.client = axios.create({
        baseURL: this.baseURL,
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'envfly-cli/1.0.0'
        }
      });

      // Add request interceptor for authentication
      this.client.interceptors.request.use(async (config) => {
        const authHeaders = await authManager.getAuthHeaders();
        config.headers = { ...config.headers, ...authHeaders };
        return config;
      });

      // Add response interceptor for error handling
      this.client.interceptors.response.use(
        (response) => response,
        async (error) => {
          return this.handleApiError(error);
        }
      );

    } catch (error) {
      throw new Error(`Failed to initialize API client: ${error.message}`);
    }
  }

  /**
   * Handle API errors with retries and user-friendly messages
   */
  async handleApiError(error) {
    const { config, response, code } = error;

    // Network errors
    if (code === 'ECONNREFUSED') {
      throw new Error('Could not connect to EnvFly server. Please check your internet connection.');
    }

    if (code === 'ENOTFOUND') {
      throw new Error('EnvFly server not found. Please check the API endpoint configuration.');
    }

    if (code === 'ETIMEDOUT') {
      throw new Error('Request timed out. Please try again.');
    }

    // HTTP errors
    if (response) {
      const { status, data } = response;

      switch (status) {
        case 401:
          throw new Error('Authentication failed. Please run "envfly login" to authenticate.');
        
        case 403:
          throw new Error('Access denied. You do not have permission to perform this action.');
        
        case 404:
          throw new Error('Resource not found. Please check the environment name and project configuration.');
        
        case 409:
          throw new Error('Conflict detected. Please resolve conflicts before proceeding.');
        
        case 429:
          throw new Error('Rate limit exceeded. Please wait a moment before trying again.');
        
        case 500:
          throw new Error('Server error. Please try again later or contact support.');
        
        default:
          const message = data?.message || data?.error || 'An unexpected error occurred';
          throw new Error(`API Error (${status}): ${message}`);
      }
    }

    // Other errors
    throw new Error(`Request failed: ${error.message}`);
  }

  /**
   * Make API request with retry logic
   */
  async request(config) {
    if (!this.client) {
      await this.initialize();
    }

    let lastError;
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await this.client.request(config);
        return response.data;
      } catch (error) {
        lastError = error;
        
        // Don't retry on certain errors
        if (error.response && [401, 403, 404, 409].includes(error.response.status)) {
          throw error;
        }
        
        if (attempt < this.retryAttempts) {
          console.warn(chalk.yellow(`Request failed, retrying... (${attempt}/${this.retryAttempts})`));
          await this.delay(this.retryDelay * attempt);
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Delay function for retries
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get environments for project
   */
  async getEnvironments(projectId) {
    return await this.request({
      method: 'GET',
      url: `/projects/${projectId}/environments`
    });
  }

  /**
   * Get environment variables
   */
  async getEnvironment(projectId, environmentId) {
    return await this.request({
      method: 'GET',
      url: `/projects/${projectId}/environments/${environmentId}`
    });
  }

  /**
   * Create new environment
   */
  async createEnvironment(projectId, environmentData) {
    return await this.request({
      method: 'POST',
      url: `/projects/${projectId}/environments`,
      data: environmentData
    });
  }

  /**
   * Update environment variables
   */
  async updateEnvironment(projectId, environmentId, variables) {
    return await this.request({
      method: 'PUT',
      url: `/projects/${projectId}/environments/${environmentId}`,
      data: { variables }
    });
  }

  /**
   * Delete environment
   */
  async deleteEnvironment(projectId, environmentId) {
    return await this.request({
      method: 'DELETE',
      url: `/projects/${projectId}/environments/${environmentId}`
    });
  }

  /**
   * Get project information
   */
  async getProject(projectId) {
    return await this.request({
      method: 'GET',
      url: `/projects/${projectId}`
    });
  }

  /**
   * Create new project
   */
  async createProject(projectData) {
    return await this.request({
      method: 'POST',
      url: '/projects',
      data: projectData
    });
  }

  /**
   * Validate API key
   */
  async validateApiKey() {
    return await this.request({
      method: 'GET',
      url: '/auth/validate'
    });
  }

  /**
   * Get user profile
   */
  async getUserProfile() {
    return await this.request({
      method: 'GET',
      url: '/auth/profile'
    });
  }

  /**
   * Get team information
   */
  async getTeam(teamId) {
    return await this.request({
      method: 'GET',
      url: `/teams/${teamId}`
    });
  }

  /**
   * Upload environment file
   */
  async uploadEnvironmentFile(projectId, environmentId, fileContent) {
    return await this.request({
      method: 'POST',
      url: `/projects/${projectId}/environments/${environmentId}/upload`,
      data: { content: fileContent },
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Download environment file
   */
  async downloadEnvironmentFile(projectId, environmentId) {
    return await this.request({
      method: 'GET',
      url: `/projects/${projectId}/environments/${environmentId}/download`
    });
  }

  /**
   * Get environment history
   */
  async getEnvironmentHistory(projectId, environmentId) {
    return await this.request({
      method: 'GET',
      url: `/projects/${projectId}/environments/${environmentId}/history`
    });
  }

  /**
   * Get environment diff
   */
  async getEnvironmentDiff(projectId, environmentId, version1, version2) {
    return await this.request({
      method: 'GET',
      url: `/projects/${projectId}/environments/${environmentId}/diff`,
      params: { v1: version1, v2: version2 }
    });
  }
}

// Create singleton instance
const apiClient = new ApiClient();

// Export functions for backward compatibility
const getEnvironments = (projectId) => apiClient.getEnvironments(projectId);
const getEnvironment = (projectId, environmentId) => apiClient.getEnvironment(projectId, environmentId);
const createEnvironment = (projectId, environmentData) => apiClient.createEnvironment(projectId, environmentData);
const updateEnvironment = (projectId, environmentId, variables) => apiClient.updateEnvironment(projectId, environmentId, variables);
const deleteEnvironment = (projectId, environmentId) => apiClient.deleteEnvironment(projectId, environmentId);
const getProject = (projectId) => apiClient.getProject(projectId);
const createProject = (projectData) => apiClient.createProject(projectData);
const validateApiKey = () => apiClient.validateApiKey();
const getUserProfile = () => apiClient.getUserProfile();
const getTeam = (teamId) => apiClient.getTeam(teamId);

module.exports = {
  ApiClient,
  apiClient,
  getEnvironments,
  getEnvironment,
  createEnvironment,
  updateEnvironment,
  deleteEnvironment,
  getProject,
  createProject,
  validateApiKey,
  getUserProfile,
  getTeam
}; 