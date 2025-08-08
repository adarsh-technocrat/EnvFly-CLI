const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

/**
 * Get default configuration template
 */
function getDefaultConfig(projectName, teamId) {
  const projectId = generateProjectId(projectName);
  
  return {
    version: "1.0",
    project_id: projectId,
    project_name: projectName,
    team_id: teamId,
    environments: {
      "prod-api": {
        remote_id: null,
        description: "Production API environment",
        file: ".env.production"
      },
      "staging-api": {
        remote_id: null,
        description: "Staging API environment",
        file: ".env.staging"
      },
      "dev-api": {
        remote_id: null,
        description: "Development API environment",
        file: ".env.development"
      }
    },
    auth: {
      endpoint: "https://api.envfly.io/v1",
      encryption: {
        enabled: true,
        algorithm: "aes-256-gcm"
      }
    },
    sync: {
      auto_backup: true,
      conflict_resolution: "prompt"
    }
  };
}

/**
 * Generate a unique project ID based on project name
 */
function generateProjectId(projectName) {
  const timestamp = Date.now().toString();
  const hash = crypto.createHash('md5').update(projectName + timestamp).digest('hex');
  return `${projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${hash.substring(0, 8)}`;
}

/**
 * Load template from file
 */
async function loadTemplate() {
  const templatePath = path.join(__dirname, 'envfly-template.json');
  const templateData = await fs.readFile(templatePath, 'utf8');
  return JSON.parse(templateData);
}

/**
 * Create environment template
 */
function createEnvironmentTemplate(name, description = '', file = null) {
  return {
    remote_id: null,
    description: description,
    file: file || `.env.${name}`
  };
}

/**
 * Validate template structure
 */
function validateTemplate(template) {
  const requiredFields = ['version', 'project_id', 'project_name', 'team_id', 'environments', 'auth'];
  
  for (const field of requiredFields) {
    if (!template[field]) {
      throw new Error(`Template missing required field: ${field}`);
    }
  }
  
  if (typeof template.environments !== 'object') {
    throw new Error('Template environments must be an object');
  }
  
  if (typeof template.auth !== 'object') {
    throw new Error('Template auth must be an object');
  }
  
  return true;
}

module.exports = {
  getDefaultConfig,
  generateProjectId,
  loadTemplate,
  createEnvironmentTemplate,
  validateTemplate
}; 