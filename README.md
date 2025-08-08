<div align="center">
  <img src="https://img.shields.io/badge/EnvFly-CLI-emerald?style=for-the-badge&logo=terminal" alt="EnvFly CLI" />
  <h1 align="center">🚀 EnvFly CLI</h1>
  <p align="center">
    <strong>Git for environment variables • Secure • Fast • Team-friendly</strong>
  </p>
  <div align="center">
    <img src="https://img.shields.io/badge/Secure%20Auth-API%20Key%20Storage-emerald?style=flat-square" alt="Secure Auth" />
    <img src="https://img.shields.io/badge/Encryption-AES--256--GCM-emerald?style=flat-square" alt="AES-256 Encryption" />
    <img src="https://img.shields.io/badge/Team%20Sync-Collaborative-emerald?style=flat-square" alt="Team Sync" />
    <img src="https://img.shields.io/badge/Cross--Platform-Windows%20%7C%20macOS%20%7C%20Linux-emerald?style=flat-square" alt="Cross-Platform" />
  </div>
  <br/>
  <div align="center">
    <img src="https://img.shields.io/badge/Node.js-14+-green?style=flat-square&logo=node.js" alt="Node.js" />
    <img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" alt="License" />
    <img src="https://img.shields.io/badge/Version-1.0.0-orange?style=flat-square" alt="Version" />
  </div>
</div>

---

# EnvFly CLI

A lightweight Node.js command-line tool for syncing environment variables across teams and projects. Think of it as "Git for environment variables."

## Features

- 🔐 **Secure Authentication** - API key-based authentication with secure storage
- 🔒 **Encryption** - AES-256-GCM encryption for sensitive environment variables
- 👥 **Team Collaboration** - Share environments across your team
- 🌍 **Multiple Environments** - Manage prod, staging, dev, and custom environments
- ⚡ **Fast & Lightweight** - Built with modern Node.js and minimal dependencies
- 🔄 **Conflict Resolution** - Smart conflict detection and resolution
- 📊 **Status Tracking** - Track sync status and environment health
- 🔧 **Cross-Platform** - Works on Windows, macOS, and Linux

## Installation

### Global Installation

```bash
npm install -g envfly-cli
```

### Local Development

```bash
git clone <repository-url>
cd envfly-cli
npm install
npm run dev
```

## Quick Start

1. **Initialize EnvFly in your project:**

   ```bash
   envfly init
   ```

2. **Authenticate with EnvFly:**

   ```bash
   envfly login
   ```

3. **List available environments:**

   ```bash
   envfly list
   ```

4. **Sync an environment:**
   ```bash
   envfly sync prod-api
   ```

## Commands

### `envfly init`

Initialize EnvFly in your current project. This creates a `.envfly` configuration file.

```bash
envfly init
```

**Options:**

- Creates default environment configurations (prod-api, staging-api, dev-api)
- Prompts for project name and team ID
- Optionally creates sample environment files
- Configures encryption settings

### `envfly login`

Authenticate with the EnvFly service using your API key.

```bash
envfly login
```

**Features:**

- Secure API key storage using system keychain
- Validates credentials against EnvFly server
- Supports re-authentication with different keys

### `envfly sync <environment>`

Sync environment variables between local and remote, with conflict resolution.

```bash
envfly sync prod-api
envfly sync --all
envfly sync staging-api --force
```

**Options:**

- `--all` - Sync all environments
- `--force` - Force sync without confirmation prompts

**Conflict Resolution:**

- Use local values (overwrite remote)
- Use remote values (overwrite local)
- Merge (keep both, remote wins on conflicts)
- Cancel sync

### `envfly push <environment>`

Push local environment variables to the remote EnvFly service.

```bash
envfly push prod-api
```

**Features:**

- Creates remote environment if it doesn't exist
- Encrypts variables before upload
- Validates environment structure
- Updates configuration with remote ID

### `envfly pull <environment>`

Pull remote environment variables to your local `.env` file.

```bash
envfly pull prod-api
```

**Features:**

- Creates backup of existing local file
- Decrypts variables after download
- Validates remote environment structure
- Shows variable preview

### `envfly list`

List all available environments with their status and metadata.

```bash
envfly list
# or
envfly ls
```

**Displays:**

- Project information
- Environment status table
- Local vs remote variable counts
- Last sync times
- Sync status indicators

## Configuration

### `.envfly` File

The `.envfly` file contains your project configuration:

```json
{
  "version": "1.0",
  "project_id": "my-project-abc123",
  "project_name": "My Awesome Project",
  "team_id": "team_123",
  "environments": {
    "prod-api": {
      "remote_id": "env_prod_abc123",
      "description": "Production API environment",
      "file": ".env.production"
    },
    "staging-api": {
      "remote_id": "env_staging_xyz789",
      "description": "Staging API environment",
      "file": ".env.staging"
    },
    "dev-api": {
      "remote_id": "env_dev_def456",
      "description": "Development API environment",
      "file": ".env.development"
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
    "conflict_resolution": "prompt"
  }
}
```

### Environment File Format

EnvFly supports standard `.env` file format:

```bash
# Database Configuration
DATABASE_URL=postgresql://user:pass@localhost:5432/mydb
DB_POOL_SIZE=10

# API Configuration
API_KEY=your_api_key_here
API_TIMEOUT=30000

# Feature Flags
ENABLE_CACHE=true
DEBUG_MODE=false

# Multiline values (use backslash)
COMPLEX_CONFIG="This is a \
multiline configuration \
value"
```

## Security

### Authentication

- API keys are stored securely using the system keychain (keytar)
- Keys are validated against the EnvFly server
- Automatic token refresh and validation

### Encryption

- AES-256-GCM encryption for environment variables
- Key derivation from API key using PBKDF2
- Encrypted data is never stored locally
- Optional encryption per project

### Best Practices

1. **Never commit `.env` files** - Add them to `.gitignore`
2. **Use strong API keys** - Rotate keys regularly
3. **Enable encryption** - For sensitive environment variables
4. **Review conflicts** - Always review before resolving conflicts
5. **Backup regularly** - EnvFly creates backups automatically

## Error Handling

EnvFly provides clear error messages and recovery suggestions:

### Common Errors

**Configuration Missing:**

```
Error: Configuration file not found. Run "envfly init" to initialize.
```

**Authentication Required:**

```
Error: You are not authenticated. Please run "envfly login" first.
```

**Environment Not Found:**

```
Error: Environment "prod-api" not found in configuration.
```

**Network Issues:**

```
Error: Could not connect to EnvFly server. Please check your internet connection.
```

### Recovery Steps

1. **Check configuration:** Ensure `.envfly` file exists and is valid
2. **Re-authenticate:** Run `envfly login` to refresh credentials
3. **Check network:** Verify internet connection and API endpoint
4. **Review conflicts:** Use `envfly list` to check environment status

## Development

### Project Structure

```
envfly-cli/
├── bin/
│   └── envfly.js              # CLI entry point
├── src/
│   ├── commands/              # Command implementations
│   │   ├── init.js
│   │   ├── login.js
│   │   ├── sync.js
│   │   ├── push.js
│   │   ├── pull.js
│   │   └── list.js
│   ├── lib/                   # Core libraries
│   │   ├── config.js          # Configuration management
│   │   ├── api.js             # API client
│   │   ├── auth.js            # Authentication
│   │   ├── crypto.js          # Encryption utilities
│   │   ├── env-parser.js      # .env file parsing
│   │   └── utils.js           # Common utilities
│   ├── templates/             # Configuration templates
│   └── index.js               # Main CLI router
├── tests/                     # Test suite
├── package.json
└── README.md
```

### Running Tests

```bash
npm test
```

### Building

```bash
npm run build
```

### Local Installation

```bash
npm run publish-local
```

## API Integration

### Endpoints

EnvFly CLI communicates with the EnvFly API:

- `GET /auth/validate` - Validate API key
- `GET /auth/profile` - Get user profile
- `GET /projects/{id}/environments` - List environments
- `GET /projects/{id}/environments/{envId}` - Get environment
- `POST /projects/{id}/environments` - Create environment
- `PUT /projects/{id}/environments/{envId}` - Update environment
- `DELETE /projects/{id}/environments/{envId}` - Delete environment

### Authentication

All API requests include:

```
Authorization: Bearer <api-key>
Content-Type: application/json
```

## Troubleshooting

### Keytar Issues

If you encounter keytar-related errors:

```bash
# macOS
brew install libsecret

# Ubuntu/Debian
sudo apt-get install libsecret-1-dev

# Windows
# No additional setup required
```

### Permission Issues

```bash
# Fix executable permissions
chmod +x bin/envfly.js

# Check file ownership
ls -la bin/envfly.js
```

### Network Issues

```bash
# Check API endpoint
curl https://api.envfly.io/v1/health

# Test with verbose logging
DEBUG=true envfly list
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

- **Documentation:** [docs.envfly.io](https://docs.envfly.io)
- **Issues:** [GitHub Issues](https://github.com/envfly/envfly-cli/issues)
- **Discussions:** [GitHub Discussions](https://github.com/envfly/envfly-cli/discussions)
- **Email:** support@envfly.io

## Changelog

### v1.0.0

- Initial release
- Core sync functionality
- Authentication system
- Encryption support
- Conflict resolution
- Cross-platform compatibility
