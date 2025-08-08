const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const { showError, showInfo } = require('./utils');

// Storage provider base class
class StorageProvider {
  constructor(config) {
    this.config = config;
  }

  async initialize() {
    throw new Error('initialize() must be implemented by subclass');
  }

  async store(environment, variables) {
    throw new Error('store() must be implemented by subclass');
  }

  async retrieve(environment) {
    throw new Error('retrieve() must be implemented by subclass');
  }

  async list() {
    throw new Error('list() must be implemented by subclass');
  }

  async delete(environment) {
    throw new Error('delete() must be implemented by subclass');
  }
}

// Git-based storage provider
class GitStorageProvider extends StorageProvider {
  constructor(config) {
    super(config);
    this.repoPath = config.git.repo_path || process.cwd();
    this.branch = config.git.branch || 'main';
    this.envPath = config.git.env_path || '.envfly-environments';
  }

  async initialize() {
    try {
      // Check if git is available
      execSync('git --version', { stdio: 'ignore' });
      
      // Check if current directory is a git repo
      const isGitRepo = await this.isGitRepository();
      if (!isGitRepo) {
        throw new Error('Current directory is not a git repository');
      }

      // Create environments directory if it doesn't exist
      const envDir = path.join(this.repoPath, this.envPath);
      if (!await fs.pathExists(envDir)) {
        await fs.mkdirp(envDir);
        await this.gitAdd(envDir);
        await this.gitCommit('Initialize EnvFly environments directory');
      }

      return true;
    } catch (error) {
      throw new Error(`Git initialization failed: ${error.message}`);
    }
  }

  async store(environment, variables) {
    try {
      const envDir = path.join(this.repoPath, this.envPath);
      const envFile = path.join(envDir, `${environment}.json`);
      
      // Encrypt variables before storing
      const encryptedData = await this.encryptVariables(variables);
      
      // Store with metadata
      const data = {
        environment,
        variables: encryptedData,
        metadata: {
          updated_at: new Date().toISOString(),
          variable_count: Object.keys(variables).length,
          version: await this.getNextVersion(environment)
        }
      };

      await fs.writeJson(envFile, data, { spaces: 2 });
      
      // Commit changes
      await this.gitAdd(envFile);
      await this.gitCommit(`Update ${environment} environment`);
      
      return data.metadata;
    } catch (error) {
      throw new Error(`Failed to store environment ${environment}: ${error.message}`);
    }
  }

  async retrieve(environment) {
    try {
      const envDir = path.join(this.repoPath, this.envPath);
      const envFile = path.join(envDir, `${environment}.json`);
      
      if (!await fs.pathExists(envFile)) {
        throw new Error(`Environment ${environment} not found`);
      }

      const data = await fs.readJson(envFile);
      const decryptedVariables = await this.decryptVariables(data.variables);
      
      return {
        variables: decryptedVariables,
        metadata: data.metadata
      };
    } catch (error) {
      throw new Error(`Failed to retrieve environment ${environment}: ${error.message}`);
    }
  }

  async list() {
    try {
      const envDir = path.join(this.repoPath, this.envPath);
      if (!await fs.pathExists(envDir)) {
        return [];
      }

      const files = await fs.readdir(envDir);
      const environments = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const envName = file.replace('.json', '');
          const envFile = path.join(envDir, file);
          const data = await fs.readJson(envFile);
          
          environments.push({
            name: envName,
            metadata: data.metadata
          });
        }
      }

      return environments;
    } catch (error) {
      throw new Error(`Failed to list environments: ${error.message}`);
    }
  }

  async delete(environment) {
    try {
      const envDir = path.join(this.repoPath, this.envPath);
      const envFile = path.join(envDir, `${environment}.json`);
      
      if (await fs.pathExists(envFile)) {
        await fs.remove(envFile);
        await this.gitAdd(envFile);
        await this.gitCommit(`Delete ${environment} environment`);
      }
    } catch (error) {
      throw new Error(`Failed to delete environment ${environment}: ${error.message}`);
    }
  }

  // Git helper methods
  async isGitRepository() {
    try {
      execSync('git rev-parse --git-dir', { cwd: this.repoPath, stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  async gitAdd(file) {
    execSync(`git add "${file}"`, { cwd: this.repoPath, stdio: 'ignore' });
  }

  async gitCommit(message) {
    execSync(`git commit -m "${message}"`, { cwd: this.repoPath, stdio: 'ignore' });
  }

  async getNextVersion(environment) {
    try {
      const envDir = path.join(this.repoPath, this.envPath);
      const envFile = path.join(envDir, `${environment}.json`);
      
      if (await fs.pathExists(envFile)) {
        const data = await fs.readJson(envFile);
        return (data.metadata.version || 0) + 1;
      }
      return 1;
    } catch {
      return 1;
    }
  }

  // Encryption methods
  async encryptVariables(variables) {
    const key = this.config.encryption_key || process.env.ENVFLY_ENCRYPTION_KEY;
    if (!key) {
      throw new Error('Encryption key not configured');
    }

    const cipher = crypto.createCipher('aes-256-gcm', key);
    let encrypted = cipher.update(JSON.stringify(variables), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      encrypted,
      tag: cipher.getAuthTag().toString('hex')
    };
  }

  async decryptVariables(encryptedData) {
    const key = this.config.encryption_key || process.env.ENVFLY_ENCRYPTION_KEY;
    if (!key) {
      throw new Error('Encryption key not configured');
    }

    const decipher = crypto.createDecipher('aes-256-gcm', key);
    decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  }
}

// AWS Secrets Manager provider
class AWSSecretsManagerProvider extends StorageProvider {
  constructor(config) {
    super(config);
    this.region = config.aws.region || process.env.AWS_REGION || 'us-east-1';
    this.prefix = config.aws.prefix || 'envfly';
  }

  async initialize() {
    try {
      // Check if AWS SDK is available
      const AWS = require('aws-sdk');
      this.secretsManager = new AWS.SecretsManager({ region: this.region });
      
      // Test connection
      await this.secretsManager.listSecrets().promise();
      return true;
    } catch (error) {
      throw new Error(`AWS Secrets Manager initialization failed: ${error.message}`);
    }
  }

  async store(environment, variables) {
    try {
      const secretName = `${this.prefix}/${environment}`;
      const secretValue = JSON.stringify(variables);
      
      try {
        // Try to update existing secret
        await this.secretsManager.updateSecret({
          SecretId: secretName,
          SecretString: secretValue
        }).promise();
      } catch (error) {
        if (error.code === 'ResourceNotFoundException') {
          // Create new secret
          await this.secretsManager.createSecret({
            Name: secretName,
            SecretString: secretValue,
            Description: `EnvFly environment: ${environment}`
          }).promise();
        } else {
          throw error;
        }
      }

      return {
        updated_at: new Date().toISOString(),
        variable_count: Object.keys(variables).length
      };
    } catch (error) {
      throw new Error(`Failed to store environment ${environment}: ${error.message}`);
    }
  }

  async retrieve(environment) {
    try {
      const secretName = `${this.prefix}/${environment}`;
      
      const result = await this.secretsManager.getSecretValue({
        SecretId: secretName
      }).promise();

      const variables = JSON.parse(result.SecretString);
      
      return {
        variables,
        metadata: {
          updated_at: result.LastModifiedDate.toISOString(),
          variable_count: Object.keys(variables).length
        }
      };
    } catch (error) {
      throw new Error(`Failed to retrieve environment ${environment}: ${error.message}`);
    }
  }

  async list() {
    try {
      const result = await this.secretsManager.listSecrets().promise();
      const environments = [];

      for (const secret of result.SecretList) {
        if (secret.Name.startsWith(this.prefix + '/')) {
          const envName = secret.Name.replace(this.prefix + '/', '');
          environments.push({
            name: envName,
            metadata: {
              updated_at: secret.LastModifiedDate.toISOString(),
              description: secret.Description
            }
          });
        }
      }

      return environments;
    } catch (error) {
      throw new Error(`Failed to list environments: ${error.message}`);
    }
  }

  async delete(environment) {
    try {
      const secretName = `${this.prefix}/${environment}`;
      
      await this.secretsManager.deleteSecret({
        SecretId: secretName,
        ForceDeleteWithoutRecovery: true
      }).promise();
    } catch (error) {
      throw new Error(`Failed to delete environment ${environment}: ${error.message}`);
    }
  }
}

// Azure Key Vault provider
class AzureKeyVaultProvider extends StorageProvider {
  constructor(config) {
    super(config);
    this.vaultUrl = config.azure.vault_url;
    this.prefix = config.azure.prefix || 'envfly';
  }

  async initialize() {
    try {
      // Check if Azure SDK is available
      const { DefaultAzureCredential } = require('@azure/identity');
      const { SecretClient } = require('@azure/keyvault-secrets');
      
      const credential = new DefaultAzureCredential();
      this.client = new SecretClient(this.vaultUrl, credential);
      
      // Test connection
      await this.client.listPropertiesOfSecrets().next();
      return true;
    } catch (error) {
      throw new Error(`Azure Key Vault initialization failed: ${error.message}`);
    }
  }

  async store(environment, variables) {
    try {
      const secretName = `${this.prefix}-${environment}`;
      const secretValue = JSON.stringify(variables);
      
      await this.client.setSecret(secretName, secretValue);
      
      return {
        updated_at: new Date().toISOString(),
        variable_count: Object.keys(variables).length
      };
    } catch (error) {
      throw new Error(`Failed to store environment ${environment}: ${error.message}`);
    }
  }

  async retrieve(environment) {
    try {
      const secretName = `${this.prefix}-${environment}`;
      
      const secret = await this.client.getSecret(secretName);
      const variables = JSON.parse(secret.value);
      
      return {
        variables,
        metadata: {
          updated_at: secret.properties.updatedOn.toISOString(),
          variable_count: Object.keys(variables).length
        }
      };
    } catch (error) {
      throw new Error(`Failed to retrieve environment ${environment}: ${error.message}`);
    }
  }

  async list() {
    try {
      const environments = [];
      
      for await (const secret of this.client.listPropertiesOfSecrets()) {
        if (secret.name.startsWith(this.prefix + '-')) {
          const envName = secret.name.replace(this.prefix + '-', '');
          environments.push({
            name: envName,
            metadata: {
              updated_at: secret.updatedOn.toISOString(),
              enabled: secret.enabled
            }
          });
        }
      }

      return environments;
    } catch (error) {
      throw new Error(`Failed to list environments: ${error.message}`);
    }
  }

  async delete(environment) {
    try {
      const secretName = `${this.prefix}-${environment}`;
      await this.client.beginDeleteSecret(secretName);
    } catch (error) {
      throw new Error(`Failed to delete environment ${environment}: ${error.message}`);
    }
  }
}

// Google Secret Manager provider
class GoogleSecretManagerProvider extends StorageProvider {
  constructor(config) {
    super(config);
    this.projectId = config.google.project_id || process.env.GOOGLE_CLOUD_PROJECT;
    this.prefix = config.google.prefix || 'envfly';
  }

  async initialize() {
    try {
      // Check if Google Cloud SDK is available
      const {SecretManagerServiceClient} = require('@google-cloud/secret-manager');
      this.client = new SecretManagerServiceClient();
      
      // Test connection
      await this.client.listSecrets({parent: `projects/${this.projectId}`});
      return true;
    } catch (error) {
      throw new Error(`Google Secret Manager initialization failed: ${error.message}`);
    }
  }

  async store(environment, variables) {
    try {
      const secretId = `${this.prefix}-${environment}`;
      const secretValue = JSON.stringify(variables);
      
      const [secret] = await this.client.createSecret({
        parent: `projects/${this.projectId}`,
        secretId: secretId,
        secret: {
          replication: {
            automatic: {},
          },
        },
      });

      await this.client.addSecretVersion({
        parent: secret.name,
        payload: {
          data: Buffer.from(secretValue, 'utf8'),
        },
      });

      return {
        updated_at: new Date().toISOString(),
        variable_count: Object.keys(variables).length
      };
    } catch (error) {
      throw new Error(`Failed to store environment ${environment}: ${error.message}`);
    }
  }

  async retrieve(environment) {
    try {
      const secretId = `${this.prefix}-${environment}`;
      const name = `projects/${this.projectId}/secrets/${secretId}/versions/latest`;
      
      const [version] = await this.client.accessSecretVersion({name});
      const variables = JSON.parse(version.payload.data.toString('utf8'));
      
      return {
        variables,
        metadata: {
          updated_at: version.createTime.toDate().toISOString(),
          variable_count: Object.keys(variables).length
        }
      };
    } catch (error) {
      throw new Error(`Failed to retrieve environment ${environment}: ${error.message}`);
    }
  }

  async list() {
    try {
      const [secrets] = await this.client.listSecrets({
        parent: `projects/${this.projectId}`,
      });

      const environments = [];
      
      for (const secret of secrets) {
        const secretName = secret.name.split('/').pop();
        if (secretName.startsWith(this.prefix + '-')) {
          const envName = secretName.replace(this.prefix + '-', '');
          environments.push({
            name: envName,
            metadata: {
              updated_at: secret.createTime.toDate().toISOString(),
              labels: secret.labels
            }
          });
        }
      }

      return environments;
    } catch (error) {
      throw new Error(`Failed to list environments: ${error.message}`);
    }
  }

  async delete(environment) {
    try {
      const secretId = `${this.prefix}-${environment}`;
      const name = `projects/${this.projectId}/secrets/${secretId}`;
      
      await this.client.deleteSecret({name});
    } catch (error) {
      throw new Error(`Failed to delete environment ${environment}: ${error.message}`);
    }
  }
}

// Storage provider factory
class StorageProviderFactory {
  static async create(providerType, config) {
    let provider;

    switch (providerType) {
      case 'git':
        provider = new GitStorageProvider(config);
        break;
      case 'aws':
        provider = new AWSSecretsManagerProvider(config);
        break;
      case 'azure':
        provider = new AzureKeyVaultProvider(config);
        break;
      case 'google':
        provider = new GoogleSecretManagerProvider(config);
        break;
      default:
        throw new Error(`Unsupported storage provider: ${providerType}`);
    }

    await provider.initialize();
    return provider;
  }

  static getSupportedProviders() {
    return [
      {
        type: 'git',
        name: 'Git Repository',
        description: 'Store environments in Git repository (encrypted)',
        requires: ['git repository']
      },
      {
        type: 'aws',
        name: 'AWS Secrets Manager',
        description: 'Store environments in AWS Secrets Manager',
        requires: ['AWS credentials', 'Secrets Manager access']
      },
      {
        type: 'azure',
        name: 'Azure Key Vault',
        description: 'Store environments in Azure Key Vault',
        requires: ['Azure credentials', 'Key Vault access']
      },
      {
        type: 'google',
        name: 'Google Secret Manager',
        description: 'Store environments in Google Secret Manager',
        requires: ['Google Cloud credentials', 'Secret Manager access']
      }
    ];
  }
}

module.exports = {
  StorageProvider,
  GitStorageProvider,
  AWSSecretsManagerProvider,
  AzureKeyVaultProvider,
  GoogleSecretManagerProvider,
  StorageProviderFactory
}; 