# EnvFly Complete Deployment Guide

This guide will help you deploy the complete EnvFly system with both the CLI and backend services.

## 🏗️ System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   EnvFly CLI    │    │   Web Frontend  │    │   Mobile App    │
│   (npm package) │    │   (optional)    │    │   (optional)    │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │    EnvFly Backend API     │
                    │   (Node.js + Express)     │
                    │   Port: 3000              │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │      MongoDB Database     │
                    │   Port: 27017             │
                    └───────────────────────────┘
```

## 📋 Prerequisites

- **Docker** and **Docker Compose**
- **Node.js 18+** (for CLI development)
- **Git**

## 🚀 Quick Start (Recommended)

### 1. Clone the Repository

```bash
git clone <repository-url>
cd envfly-cli
```

### 2. Deploy Backend with Docker

```bash
# Navigate to backend directory
cd backend

# Copy environment file
cp env.example .env

# Edit environment variables
nano .env
```

**Required Environment Variables:**

```env
# Required
JWT_SECRET=your-super-secret-jwt-key-change-in-production
MONGODB_URI=mongodb://admin:password@mongodb:27017/envfly?authSource=admin

# Optional
NODE_ENV=production
PORT=3000
CORS_ORIGINS=http://localhost:3000,https://yourdomain.com
```

### 3. Start Backend Services

```bash
# Start all services
docker-compose up -d

# Check if services are running
docker-compose ps

# View logs
docker-compose logs -f backend
```

### 4. Verify Backend is Running

```bash
# Check health endpoint
curl http://localhost:3000/health

# Check API endpoint
curl http://localhost:3000/api/v1
```

### 5. Install and Configure CLI

```bash
# Navigate back to root
cd ..

# Install CLI globally
npm install -g .

# Test CLI installation
envfly --version
```

### 6. Configure CLI for Local Backend

```bash
# Initialize EnvFly in a project
mkdir my-project && cd my-project
envfly init

# Choose: EnvFly Cloud Service
# Enter endpoint: http://localhost:3000/api/v1
# Login with default credentials:
# Email: admin@envfly.io
# Password: admin123
```

## 🔧 Manual Backend Deployment

### Option 1: Local MongoDB

```bash
# Install MongoDB
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

### Option 2: MongoDB Atlas (Cloud)

1. Create MongoDB Atlas account
2. Create a cluster
3. Get connection string
4. Update `MONGODB_URI` in `.env`

### Deploy Backend

```bash
cd backend

# Install dependencies
npm install

# Configure environment
cp env.example .env
nano .env

# Start server
npm start
```

## 🌐 Production Deployment

### Using Docker Compose

```bash
# Production environment file
cp env.example .env.production
nano .env.production

# Start with production config
docker-compose --env-file .env.production up -d
```

### Using Kubernetes

```bash
# Apply Kubernetes manifests
kubectl apply -f k8s/

# Check deployment
kubectl get pods -n envfly
kubectl get services -n envfly
```

### Using Cloud Platforms

#### AWS ECS

```bash
# Build and push Docker image
docker build -t envfly-backend .
docker tag envfly-backend:latest your-registry/envfly-backend:latest
docker push your-registry/envfly-backend:latest

# Deploy to ECS
aws ecs create-service --cluster your-cluster --service-name envfly-backend
```

#### Google Cloud Run

```bash
# Build and deploy
gcloud builds submit --tag gcr.io/your-project/envfly-backend
gcloud run deploy envfly-backend --image gcr.io/your-project/envfly-backend
```

## 🔐 Security Configuration

### 1. Change Default Credentials

```bash
# Access MongoDB
docker exec -it envfly-mongodb mongosh

# Change admin password
use admin
db.changeUserPassword("admin", "new-secure-password")

# Update .env file
MONGODB_URI=mongodb://admin:new-secure-password@mongodb:27017/envfly?authSource=admin
```

### 2. Generate Strong JWT Secret

```bash
# Generate secure JWT secret
openssl rand -base64 64

# Update .env file
JWT_SECRET=your-generated-secret
```

### 3. Configure CORS

```env
# Allow only your domains
CORS_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

### 4. Enable HTTPS

```bash
# Using nginx reverse proxy
sudo apt install nginx certbot python3-certbot-nginx

# Configure nginx
sudo nano /etc/nginx/sites-available/envfly

# Enable site
sudo ln -s /etc/nginx/sites-available/envfly /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com
```

## 📊 Monitoring & Logging

### Health Checks

```bash
# API health
curl http://localhost:3000/health

# Database health
curl http://localhost:3000/health/db

# Set up monitoring
docker-compose up -d prometheus grafana
```

### Log Management

```bash
# View logs
docker-compose logs -f backend

# Log rotation
sudo logrotate /etc/logrotate.d/envfly

# Centralized logging (ELK Stack)
docker-compose up -d elasticsearch kibana logstash
```

## 🔄 Backup & Recovery

### Database Backup

```bash
# Create backup script
cat > backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker exec envfly-mongodb mongodump --out /data/backup_$DATE
docker cp envfly-mongodb:/data/backup_$DATE ./backups/
EOF

chmod +x backup.sh

# Schedule backups
crontab -e
# Add: 0 2 * * * /path/to/backup.sh
```

### Restore Database

```bash
# Restore from backup
docker cp ./backups/backup_20240101_120000 envfly-mongodb:/data/
docker exec envfly-mongodb mongorestore /data/backup_20240101_120000
```

## 🧪 Testing the Deployment

### 1. Test Backend API

```bash
# Test authentication
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@envfly.io","password":"admin123"}'

# Test team creation
curl -X POST http://localhost:3000/api/v1/teams \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"name":"Test Team","description":"Test team"}'
```

### 2. Test CLI Integration

```bash
# Create test project
mkdir test-project && cd test-project

# Initialize EnvFly
envfly init

# Create environment
echo "API_KEY=test123" > .env
envfly push production

# Verify sync
envfly pull production
```

### 3. Test Team Features

```bash
# Create team
envfly team create "Development Team"

# Invite member
envfly team invite "developer@company.com"

# List teams
envfly team list
```

## 🚨 Troubleshooting

### Common Issues

#### Backend Won't Start

```bash
# Check logs
docker-compose logs backend

# Check MongoDB connection
docker-compose logs mongodb

# Verify environment variables
docker-compose config
```

#### CLI Can't Connect

```bash
# Check backend URL in config
cat .envfly

# Test connectivity
curl http://localhost:3000/health

# Check CORS settings
curl -H "Origin: http://localhost:3000" http://localhost:3000/api/v1
```

#### Database Connection Issues

```bash
# Check MongoDB status
docker-compose ps mongodb

# Check MongoDB logs
docker-compose logs mongodb

# Test connection
docker exec -it envfly-mongodb mongosh
```

### Performance Issues

```bash
# Check resource usage
docker stats

# Monitor MongoDB performance
docker exec -it envfly-mongodb mongosh --eval "db.stats()"

# Check API response times
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3000/health
```

## 📈 Scaling

### Horizontal Scaling

```bash
# Scale backend services
docker-compose up -d --scale backend=3

# Use load balancer
docker-compose up -d nginx
```

### Database Scaling

```bash
# MongoDB replica set
docker-compose -f docker-compose.replica.yml up -d

# MongoDB sharding
docker-compose -f docker-compose.sharded.yml up -d
```

## 🔄 Updates

### Update Backend

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Update CLI

```bash
# Update npm package
npm update -g envfly-cli

# Or reinstall
npm uninstall -g envfly-cli
npm install -g .
```

## 📞 Support

- **Documentation**: Check README files in each directory
- **Issues**: Create GitHub issues
- **Discord**: Join community server
- **Email**: support@envfly.io

---

**Happy Deploying! 🚀**
