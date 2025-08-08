# EnvFly CLI

![EnvFly CLI Banner](https://img.shields.io/badge/EnvFly-CLI-emerald?style=for-the-badge&logo=terminal)

A lightweight Node.js command-line tool for syncing environment variables across teams and projects. Think of it as "Git for environment variables" - secure, fast, and team-friendly.

## ✨ Features

- 🔐 **Secure Storage** - Client-side encryption with AES-256-GCM
- 🌐 **Multiple Storage Providers** - Git, AWS, Azure, Google Cloud, or EnvFly Cloud
- 👥 **Team Collaboration** - Share environments with team members
- 🔄 **Conflict Resolution** - Smart merging and conflict detection
- 📊 **Audit Logs** - Track all environment changes
- 🚀 **Fast & Lightweight** - Built with Node.js, works everywhere
- 🔧 **Easy Setup** - Simple initialization and configuration

## 🚀 Quick Start

### Installation

```bash
npm install -g envfly-cli
```

### Initialize Project

```bash
# Initialize with your preferred storage provider
envfly init

# Choose from:
# - Git Repository (encrypted)
# - AWS Secrets Manager
# - Azure Key Vault
# - Google Secret Manager
# - EnvFly Cloud Service
```

### Basic Usage

```bash
# List environments
envfly list

# Push environment to storage
envfly push production

# Pull environment from storage
envfly pull staging

# Sync environment (merge local and remote)
envfly sync development
```

## 📦 Storage Providers

EnvFly supports multiple storage backends, so you can use your existing cloud infrastructure:

### 🔧 Git Repository

Store encrypted environment variables directly in your Git repository:

```bash
envfly init
# Choose: Git Repository (encrypted)
# Enter encryption key
# Set environment files path
```

**Features:**

- Client-side encryption before Git commit
- Version control for environment changes
- Works with any Git hosting (GitHub, GitLab, etc.)
- No external dependencies

### ☁️ AWS Secrets Manager

Use AWS Secrets Manager for enterprise-grade secret management:

```bash
envfly init
# Choose: AWS Secrets Manager
# Configure AWS region and prefix
```

**Requirements:**

- AWS credentials configured (`aws configure`)
- Secrets Manager access permissions
- Optional: Install `aws-sdk` for better performance

### 🔷 Azure Key Vault

Store environments in Azure Key Vault:

```bash
envfly init
# Choose: Azure Key Vault
# Enter Key Vault URL
# Configure prefix
```

**Requirements:**

- Azure credentials (Azure CLI, Managed Identity, or Service Principal)
- Key Vault access permissions
- Optional: Install `@azure/identity` and `@azure/keyvault-secrets`

### 🌐 Google Secret Manager

Use Google Cloud Secret Manager:

```bash
envfly init
# Choose: Google Secret Manager
# Enter Project ID
# Configure prefix
```

**Requirements:**

- Google Cloud credentials (`gcloud auth application-default login`)
- Secret Manager access permissions
- Optional: Install `@google-cloud/secret-manager`

### 🚀 EnvFly Cloud Service

Use EnvFly's hosted service with team features:

```bash
envfly login
envfly init
# Choose: EnvFly Cloud Service
# Set up team access
```

## 📋 Commands

### Core Commands

| Command             | Description                                                          |
| ------------------- | -------------------------------------------------------------------- |
| `envfly init`       | Initialize EnvFly in current project with storage provider selection |
| `envfly login`      | Authenticate with EnvFly Cloud Service                               |
| `envfly list`       | List available environments and their status                         |
| `envfly push <env>` | Push local environment to storage                                    |
| `envfly pull <env>` | Pull environment from storage to local                               |
| `envfly sync <env>` | Sync environment (merge local and remote)                            |

### Team Management (EnvFly Cloud)

| Command                                       | Description                         |
| --------------------------------------------- | ----------------------------------- |
| `envfly team create <name>`                   | Create a new team                   |
| `envfly team list`                            | List teams you're a member of       |
| `envfly team invite <email> [role]`           | Invite member to current team       |
| `envfly team join <code>`                     | Join team with invite code          |
| `envfly team members [teamId]`                | List team members                   |
| `envfly team grant <user> <env> [permission]` | Grant environment access            |
| `envfly team share-env <env> <team> [keys]`   | Share environment with another team |

### Advanced Features

| Command                | Description                      |
| ---------------------- | -------------------------------- |
| `envfly history <env>` | Show environment version history |
| `envfly audit <env>`   | Show detailed audit logs         |

## 🔐 Security & Access Control

### Role-Based Permissions

- **Admin**: Full access to all environments and team management
- **Developer**: Read/write access to assigned environments
- **Readonly**: Read-only access to assigned environments

### Environment-Level Access

- Granular permissions per environment
- Cross-team environment sharing
- Audit trail for all access

### Encryption

- Client-side AES-256-GCM encryption
- Zero-knowledge architecture (server never sees plaintext)
- Secure key derivation with PBKDF2

## 👥 Team Sharing Workflows

### New Team Setup

```bash
# 1. Create team
envfly team create "Backend Team"

# 2. Invite members
envfly team invite alice@company.com developer
envfly team invite bob@company.com readonly

# 3. Share environments
envfly team grant alice production readwrite
envfly team grant bob staging readonly
```

### Environment Sharing Between Teams

```bash
# Share production environment with frontend team
envfly team share-env production frontend-team

# Grant specific access to shared environment
envfly team grant frontend-team production readonly
```

### Granular Access Control

```bash
# Grant access to specific environment variables only
envfly team grant alice production readonly --keys API_KEY,DATABASE_URL

# Revoke access
envfly team revoke alice production
```

### Environment Versioning

```bash
# View environment history
envfly history production

# Rollback to previous version
envfly rollback production v3
```

## 🔧 Configuration

### .envfly Configuration File

```json
{
  "version": "1.0",
  "project_id": "proj_abc123",
  "project_name": "My Awesome App",
  "team_id": "team_xyz789",
  "storage": {
    "provider": "aws",
    "config": {
      "aws": {
        "region": "us-east-1",
        "prefix": "envfly"
      }
    }
  },
  "environments": {
    "production": {
      "remote_id": "env_prod_123",
      "description": "Production environment",
      "file": ".env.production",
      "last_push": "2024-01-01T00:00:00Z",
      "last_pull": "2024-01-01T00:00:00Z"
    }
  },
  "auth": {
    "endpoint": "https://api.envfly.io/v1",
    "encryption": {
      "enabled": true,
      "algorithm": "aes-256-gcm"
    }
  },
  "sync": {
    "auto_backup": true,
    "conflict_resolution": "prompt",
    "audit_logs": true
  }
}
```

## 🛠️ Development

### Prerequisites

- Node.js >= 14.0.0
- Git (for Git storage provider)

### Installation

```bash
git clone https://github.com/your-org/envfly-cli.git
cd envfly-cli
npm install
```

### Development Commands

```bash
# Run in development mode
npm run dev

# Run tests
npm test

# Build package
npm run build
```

### Optional Dependencies

Install cloud provider SDKs for better performance:

```bash
# AWS Secrets Manager
npm install aws-sdk

# Azure Key Vault
npm install @azure/identity @azure/keyvault-secrets

# Google Secret Manager
npm install @google-cloud/secret-manager
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📖 [Documentation](https://docs.envfly.io)
- 💬 [Discord Community](https://discord.gg/envfly)
- 🐛 [Issue Tracker](https://github.com/your-org/envfly-cli/issues)
- 📧 [Email Support](mailto:support@envfly.io)

---

**Made with ❤️ by the EnvFly Team**
