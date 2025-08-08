# Cloud Deployment Scripts

This directory contains automated deployment scripts for AWS, Azure, and Google Cloud Platform. These scripts make it easy to deploy the EnvFly backend to your preferred cloud provider with minimal configuration.

## 🚀 Quick Start

Choose your cloud provider and run the corresponding script:

### AWS Deployment

```bash
# Deploy to AWS
./scripts/deploy-aws.sh

# Update deployment
./scripts/update-aws.sh

# Destroy deployment
./scripts/destroy-aws.sh
```

### Azure Deployment

```bash
# Deploy to Azure
./scripts/deploy-azure.sh

# Update deployment
./scripts/update-azure.sh

# Destroy deployment
./scripts/destroy-azure.sh
```

### Google Cloud Platform Deployment

```bash
# Deploy to GCP
./scripts/deploy-gcp.sh

# Update deployment
./scripts/update-gcp.sh

# Destroy deployment
./scripts/destroy-gcp.sh
```

## 📋 Prerequisites

### For All Cloud Providers

- **Docker** installed and running
- **Git** for cloning the repository
- **Email Provider** (optional but recommended):
  - Resend account and API key (recommended)
  - Or SMTP credentials for email notifications

### AWS Prerequisites

- **AWS CLI** installed and configured
- AWS account with appropriate permissions
- Run `aws configure` to set up credentials

### Azure Prerequisites

- **Azure CLI** installed and configured
- Azure subscription with billing enabled
- Run `az login` to authenticate

### GCP Prerequisites

- **Google Cloud CLI** installed and configured
- GCP project with billing enabled
- Run `gcloud auth login` to authenticate

## 🔧 What Each Script Does

### Deploy Scripts (`deploy-*.sh`)

#### AWS Deployment

1. **Creates ECR Repository** - For storing Docker images
2. **Builds and Pushes Image** - Your application container
3. **Creates VPC and Networking** - Isolated network environment
4. **Creates RDS MongoDB Instance** - Managed database
5. **Creates ECS Cluster** - Container orchestration
6. **Creates Application Load Balancer** - Traffic distribution
7. **Deploys ECS Service** - Runs your application
8. **Sets up Monitoring** - CloudWatch logs and metrics

#### Azure Deployment

1. **Creates Resource Group** - Organizes all resources
2. **Creates Container Registry** - For Docker images
3. **Builds and Pushes Image** - Your application container
4. **Creates Cosmos DB** - MongoDB-compatible database
5. **Creates Application Insights** - Monitoring and logging
6. **Creates Container Instance** - Runs your application
7. **Creates Key Vault** - Secure secret management
8. **Optionally creates Front Door** - Global distribution

#### GCP Deployment

1. **Enables Required APIs** - Cloud Run, Container Registry, etc.
2. **Builds and Pushes Image** - Using Cloud Build
3. **Creates Firestore Database** - NoSQL database
4. **Creates Secrets** - In Secret Manager
5. **Creates Service Account** - With appropriate permissions
6. **Deploys to Cloud Run** - Serverless container platform
7. **Sets up Monitoring** - Cloud Logging and Monitoring
8. **Optionally configures custom domain**

### Update Scripts (`update-*.sh`)

- Builds new Docker image with latest code
- Pushes image to container registry
- Updates the running service
- Performs health checks
- **Preserves all data and configuration**

### Destroy Scripts (`destroy-*.sh`)

- **⚠️ WARNING: Destroys ALL resources and data**
- Removes all cloud resources created by deployment
- Cleans up configuration files
- **This action cannot be undone**

## 💰 Cost Estimation

### AWS (Monthly)

- **ECR**: ~$5-10 (image storage)
- **ECS Fargate**: ~$20-50 (compute)
- **RDS MongoDB**: ~$30-100 (database)
- **ALB**: ~$20 (load balancer)
- **Data Transfer**: ~$5-20
- **Total**: ~$80-200/month

### Azure (Monthly)

- **Container Registry**: ~$5-10
- **Container Instances**: ~$20-50
- **Cosmos DB**: ~$25-100
- **Application Insights**: ~$5-15
- **Key Vault**: ~$3-10
- **Total**: ~$58-185/month

### GCP (Monthly)

- **Container Registry**: ~$5-10
- **Cloud Run**: ~$10-30 (pay per request)
- **Firestore**: ~$25-100
- **Secret Manager**: ~$5-15
- **Total**: ~$45-155/month

_Note: Costs vary based on usage, region, and resource sizing_

## 🔐 Security Features

All deployments include:

- **Encrypted data at rest and in transit**
- **IAM/RBAC access control**
- **Secret management**
- **Network isolation**
- **Audit logging**
- **Automatic security updates**

## 📊 Monitoring and Logging

### AWS

- **CloudWatch Logs** - Application logs
- **CloudWatch Metrics** - Performance metrics
- **CloudWatch Alarms** - Automated alerting

### Azure

- **Application Insights** - Application monitoring
- **Azure Monitor** - Infrastructure metrics
- **Log Analytics** - Centralized logging

### GCP

- **Cloud Logging** - Centralized logging
- **Cloud Monitoring** - Performance metrics
- **Error Reporting** - Error tracking

## 🔄 CI/CD Integration

You can integrate these scripts into your CI/CD pipeline:

```yaml
# GitHub Actions example
name: Deploy to Cloud
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to AWS
        run: |
          aws configure set aws_access_key_id ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws configure set aws_secret_access_key ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws configure set default.region us-east-1
          ./scripts/deploy-aws.sh
```

## 📧 Email Configuration

The deployment scripts support email notifications for team invitations, password resets, and environment changes. You can configure either Resend (recommended) or SMTP.

### Option 1: Resend (Recommended)

1. **Sign up at [resend.com](https://resend.com)**
2. **Get your API key** from the dashboard
3. **Set environment variables** before deployment:

```bash
export RESEND_API_KEY="your-resend-api-key"
export RESEND_FROM="noreply@envfly.io"
export RESEND_DOMAIN="yourdomain.com"  # Optional
```

### Option 2: SMTP

```bash
export SMTP_HOST="smtp.gmail.com"
export SMTP_PORT="587"
export SMTP_USER="your-email@gmail.com"
export SMTP_PASS="your-app-password"
export EMAIL_FROM="noreply@envfly.io"
```

### Email Provider Selection

```bash
# Use Resend (default)
export EMAIL_PROVIDER="resend"

# Or use SMTP
export EMAIL_PROVIDER="smtp"
```

**Benefits of Resend:**

- ✅ No SMTP configuration needed
- ✅ Better deliverability
- ✅ Built-in analytics
- ✅ Easy domain verification
- ✅ Free tier available

## 🚨 Troubleshooting

### Common Issues

#### AWS

```bash
# Check ECS service status
aws ecs describe-services --cluster envfly-backend --services envfly-backend

# View CloudWatch logs
aws logs tail /ecs/envfly-backend --follow

# Check ALB health
aws elbv2 describe-target-health --target-group-arn <target-group-arn>
```

#### Azure

```bash
# Check container instance status
az container show --name envfly-backend --resource-group envfly-rg

# View logs
az container logs --name envfly-backend --resource-group envfly-rg --follow

# Check Application Insights
az monitor app-insights component show --app envfly-backend-insights --resource-group envfly-rg
```

#### GCP

```bash
# Check Cloud Run service
gcloud run services describe envfly-backend --region us-central1

# View logs
gcloud logs tail --service=envfly-backend

# Check Firestore
gcloud firestore databases describe --database=envfly
```

### Getting Help

1. **Check the logs** - All scripts provide detailed logging
2. **Verify prerequisites** - Ensure all tools are installed and configured
3. **Check permissions** - Ensure your cloud account has necessary permissions
4. **Review configuration** - Check the generated config files
5. **Contact support** - Create an issue on GitHub

## 📝 Configuration Files

Each deployment creates a configuration file:

- **AWS**: `.aws-config`
- **Azure**: `.azure-config`
- **GCP**: `.gcp-config`

These files contain all the resource information and should be kept secure.

## 🔄 Migration Between Clouds

To migrate from one cloud to another:

1. **Export data** from current deployment
2. **Run destroy script** on current cloud
3. **Run deploy script** on new cloud
4. **Import data** to new deployment

## 📚 Additional Resources

- [AWS ECS Documentation](https://docs.aws.amazon.com/ecs/)
- [Azure Container Instances](https://docs.microsoft.com/en-us/azure/container-instances/)
- [Google Cloud Run](https://cloud.google.com/run/docs)
- [EnvFly Backend Documentation](../README.md)

---

**Happy Deploying! 🚀**
