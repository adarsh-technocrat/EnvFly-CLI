# EnvFly Storage Providers Examples

This guide shows how to use EnvFly CLI with different storage providers for environment variable management.

## 🔧 Git Repository Storage

Store encrypted environment variables directly in your Git repository.

### Setup

```bash
# Initialize with Git storage
envfly init

# Choose: Git Repository (encrypted)
# Enter encryption key: my-secure-key-123
# Environment files path: .envfly-environments
```

### Configuration

```json
{
  "storage": {
    "provider": "git",
    "config": {
      "encryption_key": "my-secure-key-123",
      "git": {
        "env_path": ".envfly-environments"
      }
    }
  }
}
```

### Usage

```bash
# Push environment to Git
envfly push production

# Pull environment from Git
envfly pull staging

# List environments
envfly list
```

### Git Repository Structure

```
project/
├── .env.production
├── .env.staging
├── .env.development
├── .envfly
└── .envfly-environments/
    ├── production.json
    ├── staging.json
    └── development.json
```

**Benefits:**

- ✅ No external dependencies
- ✅ Version control for environment changes
- ✅ Works with any Git hosting
- ✅ Client-side encryption
- ✅ Team collaboration via Git

---

## ☁️ AWS Secrets Manager

Use AWS Secrets Manager for enterprise-grade secret management.

### Prerequisites

```bash
# Install AWS SDK (optional, for better performance)
npm install aws-sdk

# Configure AWS credentials
aws configure
```

### Setup

```bash
# Initialize with AWS storage
envfly init

# Choose: AWS Secrets Manager
# AWS region: us-east-1
# Secret name prefix: envfly
```

### Configuration

```json
{
  "storage": {
    "provider": "aws",
    "config": {
      "aws": {
        "region": "us-east-1",
        "prefix": "envfly"
      }
    }
  }
}
```

### Usage

```bash
# Push environment to AWS Secrets Manager
envfly push production

# Pull environment from AWS Secrets Manager
envfly pull staging

# List environments
envfly list
```

### AWS Secrets Structure

```
envfly/production
envfly/staging
envfly/development
```

**Benefits:**

- ✅ Enterprise-grade security
- ✅ Automatic rotation
- ✅ IAM integration
- ✅ CloudTrail logging
- ✅ High availability

---

## 🔷 Azure Key Vault

Store environments in Azure Key Vault for Microsoft ecosystem integration.

### Prerequisites

```bash
# Install Azure SDK (optional, for better performance)
npm install @azure/identity @azure/keyvault-secrets

# Authenticate with Azure
az login
```

### Setup

```bash
# Initialize with Azure storage
envfly init

# Choose: Azure Key Vault
# Key Vault URL: https://my-vault.vault.azure.net/
# Secret name prefix: envfly
```

### Configuration

```json
{
  "storage": {
    "provider": "azure",
    "config": {
      "azure": {
        "vault_url": "https://my-vault.vault.azure.net/",
        "prefix": "envfly"
      }
    }
  }
}
```

### Usage

```bash
# Push environment to Azure Key Vault
envfly push production

# Pull environment from Azure Key Vault
envfly pull staging

# List environments
envfly list
```

### Azure Key Vault Structure

```
envfly-production
envfly-staging
envfly-development
```

**Benefits:**

- ✅ Microsoft ecosystem integration
- ✅ Managed identities support
- ✅ RBAC integration
- ✅ Soft delete and recovery
- ✅ Premium security features

---

## 🌐 Google Secret Manager

Use Google Cloud Secret Manager for GCP-native secret management.

### Prerequisites

```bash
# Install Google Cloud SDK (optional, for better performance)
npm install @google-cloud/secret-manager

# Authenticate with Google Cloud
gcloud auth application-default login
```

### Setup

```bash
# Initialize with Google storage
envfly init

# Choose: Google Secret Manager
# Project ID: my-gcp-project
# Secret name prefix: envfly
```

### Configuration

```json
{
  "storage": {
    "provider": "google",
    "config": {
      "google": {
        "project_id": "my-gcp-project",
        "prefix": "envfly"
      }
    }
  }
}
```

### Usage

```bash
# Push environment to Google Secret Manager
envfly push production

# Pull environment from Google Secret Manager
envfly pull staging

# List environments
envfly list
```

### Google Secret Manager Structure

```
projects/my-gcp-project/secrets/envfly-production
projects/my-gcp-project/secrets/envfly-staging
projects/my-gcp-project/secrets/envfly-development
```

**Benefits:**

- ✅ GCP-native integration
- ✅ Service account support
- ✅ IAM integration
- ✅ Versioning support
- ✅ Regional replication

---

## 🚀 EnvFly Cloud Service

Use EnvFly's hosted service with advanced team features.

### Setup

```bash
# Login to EnvFly Cloud
envfly login

# Initialize with EnvFly Cloud
envfly init

# Choose: EnvFly Cloud Service
# Set up team access
```

### Configuration

```json
{
  "storage": {
    "provider": "envfly"
  },
  "team_id": "team_abc123",
  "team_name": "Backend Team"
}
```

### Usage

```bash
# Push environment to EnvFly Cloud
envfly push production

# Pull environment from EnvFly Cloud
envfly pull staging

# Team management
envfly team create "Frontend Team"
envfly team invite alice@company.com developer
envfly team share-env production frontend-team

# View history and audit logs
envfly history production
envfly audit staging
```

**Benefits:**

- ✅ Advanced team collaboration
- ✅ Granular access control
- ✅ Audit logging
- ✅ Environment versioning
- ✅ Cross-team sharing

---

## 🔄 Migration Between Providers

You can migrate between storage providers by updating your configuration.

### Example: Git to AWS Migration

1. **Backup current environments:**

```bash
envfly pull production
envfly pull staging
envfly pull development
```

2. **Update configuration:**

```json
{
  "storage": {
    "provider": "aws",
    "config": {
      "aws": {
        "region": "us-east-1",
        "prefix": "envfly"
      }
    }
  }
}
```

3. **Push to new provider:**

```bash
envfly push production
envfly push staging
envfly push development
```

### Example: AWS to EnvFly Cloud Migration

1. **Backup current environments:**

```bash
envfly pull production
envfly pull staging
envfly pull development
```

2. **Login to EnvFly Cloud:**

```bash
envfly login
```

3. **Update configuration:**

```json
{
  "storage": {
    "provider": "envfly"
  },
  "team_id": "team_xyz789"
}
```

4. **Push to EnvFly Cloud:**

```bash
envfly push production
envfly push staging
envfly push development
```

---

## 🔐 Security Best Practices

### Encryption Keys

- Use strong, unique encryption keys for Git storage
- Store encryption keys securely (password managers, key management systems)
- Rotate encryption keys regularly
- Never commit encryption keys to version control

### Access Control

- Use least-privilege access for cloud storage
- Enable audit logging where available
- Regularly review access permissions
- Use service accounts for automated access

### Environment Variables

- Never store sensitive values in plain text
- Use environment-specific configurations
- Regularly rotate secrets and API keys
- Validate environment variables before deployment

---

## 🛠️ Troubleshooting

### Common Issues

**Git Storage:**

```bash
# Error: Current directory is not a git repository
git init
git add .
git commit -m "Initial commit"
envfly init
```

**AWS Storage:**

```bash
# Error: AWS credentials not configured
aws configure
# or set environment variables
export AWS_ACCESS_KEY_ID=your-key
export AWS_SECRET_ACCESS_KEY=your-secret
export AWS_REGION=us-east-1
```

**Azure Storage:**

```bash
# Error: Azure credentials not found
az login
# or set environment variables
export AZURE_CLIENT_ID=your-client-id
export AZURE_CLIENT_SECRET=your-secret
export AZURE_TENANT_ID=your-tenant-id
```

**Google Storage:**

```bash
# Error: Google Cloud credentials not found
gcloud auth application-default login
# or set environment variables
export GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
```

### Performance Optimization

- Install cloud provider SDKs for better performance
- Use appropriate regions for your deployment
- Enable caching where available
- Use connection pooling for high-frequency operations

---

## 📊 Comparison Matrix

| Feature              | Git        | AWS        | Azure      | Google     | EnvFly Cloud |
| -------------------- | ---------- | ---------- | ---------- | ---------- | ------------ |
| **Setup Complexity** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐     | ⭐⭐⭐     | ⭐⭐⭐     | ⭐⭐⭐⭐⭐   |
| **Security**         | ⭐⭐⭐⭐   | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐   |
| **Team Features**    | ⭐⭐       | ⭐⭐       | ⭐⭐       | ⭐⭐       | ⭐⭐⭐⭐⭐   |
| **Cost**             | ⭐⭐⭐⭐⭐ | ⭐⭐⭐     | ⭐⭐⭐     | ⭐⭐⭐     | ⭐⭐⭐⭐     |
| **Integration**      | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐   | ⭐⭐⭐⭐   | ⭐⭐⭐       |
| **Audit Logging**    | ⭐⭐       | ⭐⭐⭐⭐   | ⭐⭐⭐⭐   | ⭐⭐⭐⭐   | ⭐⭐⭐⭐⭐   |

**Recommendations:**

- **Small teams**: Git storage
- **AWS shops**: AWS Secrets Manager
- **Azure shops**: Azure Key Vault
- **GCP shops**: Google Secret Manager
- **Enterprise teams**: EnvFly Cloud Service
