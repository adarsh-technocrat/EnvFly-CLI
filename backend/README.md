# EnvFly Backend

A secure, scalable backend API for the EnvFly CLI tool, built with Node.js, Express, and MongoDB.

## 🚀 Features

- **Authentication & Authorization**: JWT-based authentication with role-based access control
- **Team Management**: Create teams, invite members, manage permissions
- **Project Management**: Organize environments by projects
- **Environment Variables**: Secure storage with encryption and versioning
- **Audit Logging**: Complete audit trail for all environment changes
- **API Key Support**: CLI-friendly API key authentication
- **Rate Limiting**: Built-in rate limiting for API protection
- **Docker Support**: Easy deployment with Docker and Docker Compose

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   EnvFly CLI    │    │   Web Frontend  │    │   Mobile App    │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │    EnvFly Backend API     │
                    │   (Node.js + Express)     │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │      MongoDB Database     │
                    │   (Environment Variables) │
                    └───────────────────────────┘
```

## 📋 Prerequisites

- **Docker** and **Docker Compose** (recommended)
- **Node.js 18+** (for local development)
- **MongoDB 7.0+** (if not using Docker)

## 🐳 Quick Start with Docker

### 1. Clone and Setup

```bash
# Clone the repository
git clone <repository-url>
cd envfly-cli/backend

# Copy environment file
cp env.example .env

# Edit environment variables
nano .env
```

### 2. Configure Environment Variables

Edit `.env` file with your settings:

```env
# Required
JWT_SECRET=your-super-secret-jwt-key-change-in-production
MONGODB_URI=mongodb://admin:password@mongodb:27017/envfly?authSource=admin

# Optional
NODE_ENV=production
PORT=3000
CORS_ORIGINS=http://localhost:3000,https://yourdomain.com
```

### 3. Start Services

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f backend

# Check health
curl http://localhost:3000/health
```

### 4. Access Services

- **Backend API**: http://localhost:3000
- **MongoDB**: localhost:27017
- **MongoDB Express** (optional): http://localhost:8081

## 🔧 Manual Installation

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup MongoDB

```bash
# Install MongoDB (Ubuntu/Debian)
sudo apt update
sudo apt install mongodb

# Start MongoDB
sudo systemctl start mongodb
sudo systemctl enable mongodb

# Create database and user
mongosh
> use envfly
> db.createUser({
    user: "envfly",
    pwd: "your-password",
    roles: ["readWrite"]
  })
```

### 3. Configure Environment

```bash
cp env.example .env
nano .env
```

### 4. Run Database Migrations

```bash
npm run migrate
```

### 5. Start the Server

```bash
# Development
npm run dev

# Production
npm start
```

## 📚 API Documentation

### Authentication Endpoints

```http
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET  /api/v1/auth/validate
```

### Team Management

```http
POST   /api/v1/teams
GET    /api/v1/teams
GET    /api/v1/teams/:id
PUT    /api/v1/teams/:id
DELETE /api/v1/teams/:id
POST   /api/v1/teams/:id/invite
POST   /api/v1/teams/join
GET    /api/v1/teams/:id/members
```

### Project Management

```http
POST   /api/v1/projects
GET    /api/v1/projects
GET    /api/v1/projects/:id
PUT    /api/v1/projects/:id
DELETE /api/v1/projects/:id
```

### Environment Management

```http
POST   /api/v1/environments
GET    /api/v1/environments
GET    /api/v1/environments/:id
PUT    /api/v1/environments/:id
DELETE /api/v1/environments/:id
POST   /api/v1/environments/:id/sync
GET    /api/v1/environments/:id/history
GET    /api/v1/environments/:id/audit
```

## 🔐 Security Features

- **JWT Authentication**: Secure token-based authentication
- **API Key Support**: CLI-friendly authentication
- **Role-Based Access Control**: Fine-grained permissions
- **Environment Variable Encryption**: AES-256-GCM encryption for secrets
- **Rate Limiting**: Protection against abuse
- **CORS Protection**: Configurable cross-origin requests
- **Input Validation**: Comprehensive request validation
- **Audit Logging**: Complete activity tracking

## 🗄️ Database Schema

### Users Collection

```javascript
{
  _id: ObjectId,
  email: String,
  name: String,
  password: String (hashed),
  apiKey: String,
  role: String,
  isActive: Boolean,
  teams: Array,
  createdAt: Date,
  updatedAt: Date
}
```

### Teams Collection

```javascript
{
  _id: ObjectId,
  name: String,
  description: String,
  owner: ObjectId (ref: User),
  members: Array,
  inviteCodes: Array,
  settings: Object,
  projects: Array,
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### Projects Collection

```javascript
{
  _id: ObjectId,
  name: String,
  description: String,
  owner: ObjectId (ref: User),
  team: ObjectId (ref: Team),
  storageProvider: String,
  storageConfig: Object,
  environments: Array,
  settings: Object,
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### Environments Collection

```javascript
{
  _id: ObjectId,
  projectId: ObjectId (ref: Project),
  name: String,
  description: String,
  variables: Array,
  version: Number,
  versionHistory: Array,
  auditLogs: Array,
  settings: Object,
  lastSync: Date,
  lastModified: Date,
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

## 🚀 Deployment Options

### Docker Compose (Recommended)

```bash
# Production deployment
docker-compose -f docker-compose.yml up -d

# With custom environment file
docker-compose --env-file .env.production up -d
```

### Kubernetes

```bash
# Apply Kubernetes manifests
kubectl apply -f k8s/

# Check deployment status
kubectl get pods -n envfly
```

### Cloud Platforms

- **AWS ECS**: Use provided Docker image
- **Google Cloud Run**: Serverless deployment
- **Azure Container Instances**: Container-based deployment
- **Heroku**: Use Procfile for deployment

## 🔍 Monitoring & Logging

### Health Checks

```bash
# Check API health
curl http://localhost:3000/health

# Check MongoDB connection
curl http://localhost:3000/health/db
```

### Logs

```bash
# View application logs
docker-compose logs -f backend

# View MongoDB logs
docker-compose logs -f mongodb

# Access log files
tail -f logs/combined.log
tail -f logs/error.log
```

### Metrics

The API exposes basic metrics at `/metrics` endpoint (if enabled).

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## 🔧 Development

### Local Development Setup

```bash
# Install dependencies
npm install

# Start MongoDB (using Docker)
docker run -d -p 27017:27017 --name mongodb mongo:7.0

# Start development server
npm run dev

# Run linting
npm run lint
npm run lint:fix
```

### API Testing

```bash
# Using curl
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@envfly.io","password":"admin123"}'

# Using Postman
# Import the provided Postman collection
```

## 📝 Environment Variables

| Variable         | Description                    | Default       | Required |
| ---------------- | ------------------------------ | ------------- | -------- |
| `NODE_ENV`       | Environment mode               | `development` | No       |
| `PORT`           | Server port                    | `3000`        | No       |
| `MONGODB_URI`    | MongoDB connection string      | -             | Yes      |
| `JWT_SECRET`     | JWT signing secret             | -             | Yes      |
| `JWT_EXPIRES_IN` | JWT expiration time            | `7d`          | No       |
| `CORS_ORIGINS`   | Allowed CORS origins           | `localhost`   | No       |
| `RATE_LIMIT_MAX` | Rate limit requests per window | `100`         | No       |
| `LOG_LEVEL`      | Logging level                  | `info`        | No       |
| `SMTP_HOST`      | SMTP server host               | -             | No       |
| `SMTP_USER`      | SMTP username                  | -             | No       |
| `SMTP_PASS`      | SMTP password                  | -             | No       |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

- **Documentation**: Check the API documentation
- **Issues**: Create an issue on GitHub
- **Discord**: Join our community server
- **Email**: support@envfly.io

## 🔄 Updates

To update the backend:

```bash
# Pull latest changes
git pull origin main

# Rebuild Docker image
docker-compose build --no-cache

# Restart services
docker-compose down
docker-compose up -d
```

---

**Made with ❤️ by the EnvFly Team**
