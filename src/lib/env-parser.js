const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

class EnvParser {
  constructor() {
    this.supportedFormats = ['.env', '.env.local', '.env.production', '.env.staging', '.env.development'];
  }

  /**
   * Parse .env file content into key-value object
   */
  parseEnvContent(content) {
    const lines = content.split('\n');
    const envObject = {};
    const comments = {};
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // Skip empty lines
      if (!trimmedLine) {
        continue;
      }
      
      // Handle comments
      if (trimmedLine.startsWith('#')) {
        // Store comment for next variable
        continue;
      }
      
      // Handle key=value format
      const equalIndex = trimmedLine.indexOf('=');
      if (equalIndex > 0) {
        const key = trimmedLine.substring(0, equalIndex).trim();
        let value = trimmedLine.substring(equalIndex + 1).trim();
        
        // Handle quoted values
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        
        // Handle multiline values
        if (value.endsWith('\\')) {
          value = value.slice(0, -1);
          let nextLine = '';
          let j = i + 1;
          
          while (j < lines.length) {
            nextLine = lines[j].trim();
            if (nextLine.endsWith('\\')) {
              value += nextLine.slice(0, -1);
              j++;
            } else {
              value += nextLine;
              break;
            }
          }
          i = j;
        }
        
        envObject[key] = value;
      }
    }
    
    return envObject;
  }

  /**
   * Convert object back to .env file format
   */
  stringifyEnvContent(envObject, comments = {}) {
    const lines = [];
    
    for (const [key, value] of Object.entries(envObject)) {
      // Add comment if exists
      if (comments[key]) {
        lines.push(`# ${comments[key]}`);
      }
      
      // Escape special characters and quote if necessary
      const escapedValue = this.escapeValue(value);
      lines.push(`${key}=${escapedValue}`);
    }
    
    return lines.join('\n') + '\n';
  }

  /**
   * Escape value for .env format
   */
  escapeValue(value) {
    if (typeof value !== 'string') {
      value = String(value);
    }
    
    // If value contains spaces, quotes, or special characters, quote it
    if (value.includes(' ') || value.includes('"') || value.includes("'") || 
        value.includes('#') || value.includes('$') || value.includes('\\')) {
      return `"${value.replace(/"/g, '\\"')}"`;
    }
    
    return value;
  }

  /**
   * Read and parse .env file
   */
  async readEnvFile(filePath) {
    try {
      if (!await fs.pathExists(filePath)) {
        throw new Error(`Environment file not found: ${filePath}`);
      }
      
      const content = await fs.readFile(filePath, 'utf8');
      return this.parseEnvContent(content);
    } catch (error) {
      throw new Error(`Failed to read environment file: ${error.message}`);
    }
  }

  /**
   * Write environment object to .env file
   */
  async writeEnvFile(filePath, envObject, comments = {}) {
    try {
      const content = this.stringifyEnvContent(envObject, comments);
      await fs.writeFile(filePath, content, 'utf8');
    } catch (error) {
      throw new Error(`Failed to write environment file: ${error.message}`);
    }
  }

  /**
   * Create backup of .env file
   */
  async createBackup(filePath) {
    try {
      if (!await fs.pathExists(filePath)) {
        return null;
      }
      
      const backupPath = `${filePath}.backup.${Date.now()}`;
      await fs.copy(filePath, backupPath);
      return backupPath;
    } catch (error) {
      throw new Error(`Failed to create backup: ${error.message}`);
    }
  }

  /**
   * Detect conflicts between local and remote environments
   */
  detectConflicts(localEnv, remoteEnv) {
    const conflicts = {
      added: [],
      removed: [],
      modified: [],
      unchanged: []
    };
    
    const allKeys = new Set([...Object.keys(localEnv), ...Object.keys(remoteEnv)]);
    
    for (const key of allKeys) {
      const localValue = localEnv[key];
      const remoteValue = remoteEnv[key];
      
      if (localValue === undefined && remoteValue !== undefined) {
        conflicts.added.push({ key, value: remoteValue });
      } else if (localValue !== undefined && remoteValue === undefined) {
        conflicts.removed.push({ key, value: localValue });
      } else if (localValue !== remoteValue) {
        conflicts.modified.push({ 
          key, 
          localValue, 
          remoteValue 
        });
      } else {
        conflicts.unchanged.push({ key, value: localValue });
      }
    }
    
    return conflicts;
  }

  /**
   * Generate diff report
   */
  generateDiffReport(conflicts) {
    const lines = [];
    
    if (conflicts.added.length > 0) {
      lines.push(chalk.green('Added variables:'));
      conflicts.added.forEach(({ key, value }) => {
        lines.push(chalk.green(`  + ${key}=${value}`));
      });
      lines.push('');
    }
    
    if (conflicts.removed.length > 0) {
      lines.push(chalk.red('Removed variables:'));
      conflicts.removed.forEach(({ key, value }) => {
        lines.push(chalk.red(`  - ${key}=${value}`));
      });
      lines.push('');
    }
    
    if (conflicts.modified.length > 0) {
      lines.push(chalk.yellow('Modified variables:'));
      conflicts.modified.forEach(({ key, localValue, remoteValue }) => {
        lines.push(chalk.yellow(`  ~ ${key}:`));
        lines.push(chalk.red(`    - ${localValue}`));
        lines.push(chalk.green(`    + ${remoteValue}`));
      });
      lines.push('');
    }
    
    return lines.join('\n');
  }

  /**
   * Merge environments with conflict resolution
   */
  mergeEnvironments(localEnv, remoteEnv, strategy = 'prompt') {
    switch (strategy) {
      case 'local':
        return { ...remoteEnv, ...localEnv };
      
      case 'remote':
        return { ...localEnv, ...remoteEnv };
      
      case 'merge':
        return { ...localEnv, ...remoteEnv };
      
      default:
        throw new Error(`Unknown merge strategy: ${strategy}`);
    }
  }

  /**
   * Validate environment variable names
   */
  validateVariableName(name) {
    if (!name || typeof name !== 'string') {
      return { valid: false, error: 'Variable name must be a non-empty string' };
    }
    
    if (!/^[A-Z_][A-Z0-9_]*$/i.test(name)) {
      return { 
        valid: false, 
        error: 'Variable name must start with a letter or underscore and contain only letters, numbers, and underscores' 
      };
    }
    
    return { valid: true };
  }

  /**
   * Validate environment variable value
   */
  validateVariableValue(value) {
    if (value === null || value === undefined) {
      return { valid: false, error: 'Variable value cannot be null or undefined' };
    }
    
    return { valid: true };
  }

  /**
   * Validate entire environment object
   */
  validateEnvironment(envObject) {
    const errors = [];
    
    for (const [key, value] of Object.entries(envObject)) {
      const nameValidation = this.validateVariableName(key);
      if (!nameValidation.valid) {
        errors.push(`Invalid variable name "${key}": ${nameValidation.error}`);
      }
      
      const valueValidation = this.validateVariableValue(value);
      if (!valueValidation.valid) {
        errors.push(`Invalid value for "${key}": ${valueValidation.error}`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get environment file path for environment name
   */
  getEnvFilePath(envName, config) {
    const envConfig = config.environments[envName];
    if (!envConfig) {
      throw new Error(`Environment "${envName}" not found in configuration`);
    }
    
    return path.join(process.cwd(), envConfig.file);
  }

  /**
   * List all environment files in project
   */
  async listEnvFiles(projectRoot) {
    const envFiles = [];
    
    for (const format of this.supportedFormats) {
      const filePath = path.join(projectRoot, format);
      if (await fs.pathExists(filePath)) {
        envFiles.push({
          name: format,
          path: filePath,
          size: (await fs.stat(filePath)).size
        });
      }
    }
    
    return envFiles;
  }
}

// Create singleton instance
const envParser = new EnvParser();

// Export functions for backward compatibility
const parseEnvContent = (content) => envParser.parseEnvContent(content);
const stringifyEnvContent = (envObject, comments) => envParser.stringifyEnvContent(envObject, comments);
const readEnvFile = (filePath) => envParser.readEnvFile(filePath);
const writeEnvFile = (filePath, envObject, comments) => envParser.writeEnvFile(filePath, envObject, comments);
const createBackup = (filePath) => envParser.createBackup(filePath);
const detectConflicts = (localEnv, remoteEnv) => envParser.detectConflicts(localEnv, remoteEnv);
const generateDiffReport = (conflicts) => envParser.generateDiffReport(conflicts);
const mergeEnvironments = (localEnv, remoteEnv, strategy) => envParser.mergeEnvironments(localEnv, remoteEnv, strategy);

module.exports = {
  EnvParser,
  envParser,
  parseEnvContent,
  stringifyEnvContent,
  readEnvFile,
  writeEnvFile,
  createBackup,
  detectConflicts,
  generateDiffReport,
  mergeEnvironments
}; 