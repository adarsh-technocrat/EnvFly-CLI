const crypto = require('crypto');
const { authManager } = require('./auth');

class CryptoManager {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32; // 256 bits
    this.ivLength = 16; // 128 bits
    this.tagLength = 16; // 128 bits
    this.saltLength = 64; // 512 bits
    this.iterations = 100000; // PBKDF2 iterations
  }

  /**
   * Derive encryption key from API key
   */
  async deriveKey(apiKey, salt = null) {
    if (!salt) {
      salt = crypto.randomBytes(this.saltLength);
    }

    const key = crypto.pbkdf2Sync(
      apiKey,
      salt,
      this.iterations,
      this.keyLength,
      'sha512'
    );

    return { key, salt };
  }

  /**
   * Encrypt environment variables
   */
  async encrypt(data) {
    try {
      const apiKey = await authManager.getApiKey();
      if (!apiKey) {
        throw new Error('No API key available for encryption');
      }

      const { key, salt } = await this.deriveKey(apiKey);
      const iv = crypto.randomBytes(this.ivLength);
      
      const cipher = crypto.createCipher(this.algorithm, key);
      cipher.setAAD(Buffer.from('envfly-cli', 'utf8'));
      
      let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();
      
      // Combine all components
      const result = {
        encrypted: encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
        salt: salt.toString('hex'),
        algorithm: this.algorithm
      };
      
      return result;
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt environment variables
   */
  async decrypt(encryptedData) {
    try {
      const apiKey = await authManager.getApiKey();
      if (!apiKey) {
        throw new Error('No API key available for decryption');
      }

      const { encrypted, iv, tag, salt, algorithm } = encryptedData;
      
      if (algorithm !== this.algorithm) {
        throw new Error(`Unsupported encryption algorithm: ${algorithm}`);
      }

      const { key } = await this.deriveKey(apiKey, Buffer.from(salt, 'hex'));
      const decipher = crypto.createDecipher(this.algorithm, key);
      
      decipher.setAAD(Buffer.from('envfly-cli', 'utf8'));
      decipher.setAuthTag(Buffer.from(tag, 'hex'));
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      if (error.message.includes('bad decrypt')) {
        throw new Error('Decryption failed: Invalid encryption key or corrupted data');
      }
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Encrypt single environment variable
   */
  async encryptVariable(key, value) {
    const data = { [key]: value };
    return await this.encrypt(data);
  }

  /**
   * Decrypt single environment variable
   */
  async decryptVariable(encryptedData) {
    const decrypted = await this.decrypt(encryptedData);
    const key = Object.keys(decrypted)[0];
    return { key, value: decrypted[key] };
  }

  /**
   * Encrypt environment file content
   */
  async encryptFileContent(content) {
    // Parse .env content into object
    const envObject = this.parseEnvContent(content);
    return await this.encrypt(envObject);
  }

  /**
   * Decrypt environment file content
   */
  async decryptFileContent(encryptedData) {
    const decrypted = await this.decrypt(encryptedData);
    return this.stringifyEnvContent(decrypted);
  }

  /**
   * Parse .env file content into object
   */
  parseEnvContent(content) {
    const lines = content.split('\n');
    const envObject = {};
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        continue;
      }
      
      // Handle key=value format
      const equalIndex = trimmedLine.indexOf('=');
      if (equalIndex > 0) {
        const key = trimmedLine.substring(0, equalIndex).trim();
        const value = trimmedLine.substring(equalIndex + 1).trim();
        
        // Remove quotes if present
        const cleanValue = value.replace(/^["']|["']$/g, '');
        envObject[key] = cleanValue;
      }
    }
    
    return envObject;
  }

  /**
   * Convert object back to .env file format
   */
  stringifyEnvContent(envObject) {
    const lines = [];
    
    for (const [key, value] of Object.entries(envObject)) {
      // Escape special characters in value
      const escapedValue = value.replace(/"/g, '\\"');
      lines.push(`${key}="${escapedValue}"`);
    }
    
    return lines.join('\n') + '\n';
  }

  /**
   * Generate random encryption key
   */
  generateRandomKey() {
    return crypto.randomBytes(this.keyLength).toString('hex');
  }

  /**
   * Hash data for integrity checking
   */
  hash(data) {
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }

  /**
   * Verify data integrity
   */
  verifyIntegrity(data, expectedHash) {
    const actualHash = this.hash(data);
    return actualHash === expectedHash;
  }

  /**
   * Check if encryption is enabled in config
   */
  isEncryptionEnabled(config) {
    return config?.auth?.encryption?.enabled !== false;
  }

  /**
   * Get encryption algorithm from config
   */
  getEncryptionAlgorithm(config) {
    return config?.auth?.encryption?.algorithm || this.algorithm;
  }
}

// Create singleton instance
const cryptoManager = new CryptoManager();

// Export functions for backward compatibility
const encrypt = (data) => cryptoManager.encrypt(data);
const decrypt = (encryptedData) => cryptoManager.decrypt(encryptedData);
const encryptVariable = (key, value) => cryptoManager.encryptVariable(key, value);
const decryptVariable = (encryptedData) => cryptoManager.decryptVariable(encryptedData);
const encryptFileContent = (content) => cryptoManager.encryptFileContent(content);
const decryptFileContent = (encryptedData) => cryptoManager.decryptFileContent(encryptedData);
const parseEnvContent = (content) => cryptoManager.parseEnvContent(content);
const stringifyEnvContent = (envObject) => cryptoManager.stringifyEnvContent(envObject);

module.exports = {
  CryptoManager,
  cryptoManager,
  encrypt,
  decrypt,
  encryptVariable,
  decryptVariable,
  encryptFileContent,
  decryptFileContent,
  parseEnvContent,
  stringifyEnvContent
}; 