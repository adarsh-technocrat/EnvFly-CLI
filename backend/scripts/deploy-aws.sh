#!/bin/bash

# EnvFly Backend AWS Deployment Script
# This script deploys the EnvFly backend to AWS using ECS, RDS, and Application Load Balancer

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="$PROJECT_DIR/.aws-config"

# Default values
PROJECT_NAME="envfly-backend"
AWS_REGION="us-east-1"
ENVIRONMENT="production"
DB_INSTANCE_CLASS="db.t3.micro"
DB_STORAGE_SIZE="20"
CONTAINER_CPU="256"
CONTAINER_MEMORY="512"
DESIRED_COUNT="1"
MAX_COUNT="3"

# Load configuration if exists
if [ -f "$CONFIG_FILE" ]; then
    source "$CONFIG_FILE"
fi

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if AWS CLI is installed
check_aws_cli() {
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed. Please install it first."
        print_status "Installation guide: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
        exit 1
    fi
}

# Function to check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install it first."
        exit 1
    fi
}

# Function to check AWS credentials
check_aws_credentials() {
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS credentials not configured. Please run 'aws configure' first."
        exit 1
    fi
}

# Function to get user input
get_user_input() {
    print_status "AWS Deployment Configuration"
    echo "=================================="
    
    read -p "Project name [$PROJECT_NAME]: " input_project_name
    PROJECT_NAME=${input_project_name:-$PROJECT_NAME}
    
    read -p "AWS Region [$AWS_REGION]: " input_region
    AWS_REGION=${input_region:-$AWS_REGION}
    
    read -p "Environment [$ENVIRONMENT]: " input_env
    ENVIRONMENT=${input_env:-$ENVIRONMENT}
    
    read -p "Database instance class [$DB_INSTANCE_CLASS]: " input_db_class
    DB_INSTANCE_CLASS=${input_db_class:-$DB_INSTANCE_CLASS}
    
    read -p "Database storage size (GB) [$DB_STORAGE_SIZE]: " input_db_size
    DB_STORAGE_SIZE=${input_db_size:-$DB_STORAGE_SIZE}
    
    read -p "Container CPU units [$CONTAINER_CPU]: " input_cpu
    CONTAINER_CPU=${input_cpu:-$CONTAINER_CPU}
    
    read -p "Container memory (MB) [$CONTAINER_MEMORY]: " input_memory
    CONTAINER_MEMORY=${input_memory:-$CONTAINER_MEMORY}
    
    read -p "Desired container count [$DESIRED_COUNT]: " input_desired
    DESIRED_COUNT=${input_desired:-$DESIRED_COUNT}
    
    # Save configuration
    cat > "$CONFIG_FILE" << EOF
PROJECT_NAME="$PROJECT_NAME"
AWS_REGION="$AWS_REGION"
ENVIRONMENT="$ENVIRONMENT"
DB_INSTANCE_CLASS="$DB_INSTANCE_CLASS"
DB_STORAGE_SIZE="$DB_STORAGE_SIZE"
CONTAINER_CPU="$CONTAINER_CPU"
CONTAINER_MEMORY="$CONTAINER_MEMORY"
DESIRED_COUNT="$DESIRED_COUNT"
MAX_COUNT="$MAX_COUNT"
EOF
}

# Function to create ECR repository
create_ecr_repository() {
    print_status "Creating ECR repository..."
    
    aws ecr create-repository \
        --repository-name "$PROJECT_NAME" \
        --region "$AWS_REGION" \
        --image-scanning-configuration scanOnPush=true \
        --encryption-configuration encryptionType=AES256 2>/dev/null || true
    
    # Get ECR repository URI
    ECR_REPO_URI=$(aws ecr describe-repositories \
        --repository-names "$PROJECT_NAME" \
        --region "$AWS_REGION" \
        --query 'repositories[0].repositoryUri' \
        --output text)
    
    print_success "ECR repository created: $ECR_REPO_URI"
}

# Function to build and push Docker image
build_and_push_image() {
    print_status "Building and pushing Docker image..."
    
    # Get ECR login token
    aws ecr get-login-password --region "$AWS_REGION" | \
        docker login --username AWS --password-stdin "$ECR_REPO_URI"
    
    # Build image
    docker build -t "$PROJECT_NAME" "$PROJECT_DIR"
    
    # Tag image
    docker tag "$PROJECT_NAME:latest" "$ECR_REPO_URI:latest"
    
    # Push image
    docker push "$ECR_REPO_URI:latest"
    
    print_success "Docker image pushed successfully"
}

# Function to create VPC and networking
create_networking() {
    print_status "Creating VPC and networking resources..."
    
    # Create VPC
    VPC_ID=$(aws ec2 create-vpc \
        --cidr-block 10.0.0.0/16 \
        --region "$AWS_REGION" \
        --query 'Vpc.VpcId' \
        --output text)
    
    # Create Internet Gateway
    IGW_ID=$(aws ec2 create-internet-gateway \
        --region "$AWS_REGION" \
        --query 'InternetGateway.InternetGatewayId' \
        --output text)
    
    # Attach Internet Gateway to VPC
    aws ec2 attach-internet-gateway \
        --vpc-id "$VPC_ID" \
        --internet-gateway-id "$IGW_ID" \
        --region "$AWS_REGION"
    
    # Create public subnet
    PUBLIC_SUBNET_ID=$(aws ec2 create-subnet \
        --vpc-id "$VPC_ID" \
        --cidr-block 10.0.1.0/24 \
        --availability-zone "${AWS_REGION}a" \
        --region "$AWS_REGION" \
        --query 'Subnet.SubnetId' \
        --output text)
    
    # Create private subnet
    PRIVATE_SUBNET_ID=$(aws ec2 create-subnet \
        --vpc-id "$VPC_ID" \
        --cidr-block 10.0.2.0/24 \
        --availability-zone "${AWS_REGION}b" \
        --region "$AWS_REGION" \
        --query 'Subnet.SubnetId' \
        --output text)
    
    # Create route table for public subnet
    ROUTE_TABLE_ID=$(aws ec2 create-route-table \
        --vpc-id "$VPC_ID" \
        --region "$AWS_REGION" \
        --query 'RouteTable.RouteTableId' \
        --output text)
    
    # Add route to internet gateway
    aws ec2 create-route \
        --route-table-id "$ROUTE_TABLE_ID" \
        --destination-cidr-block 0.0.0.0/0 \
        --gateway-id "$IGW_ID" \
        --region "$AWS_REGION"
    
    # Associate route table with public subnet
    aws ec2 associate-route-table \
        --subnet-id "$PUBLIC_SUBNET_ID" \
        --route-table-id "$ROUTE_TABLE_ID" \
        --region "$AWS_REGION"
    
    # Create security group for ALB
    ALB_SG_ID=$(aws ec2 create-security-group \
        --group-name "${PROJECT_NAME}-alb-sg" \
        --description "Security group for ALB" \
        --vpc-id "$VPC_ID" \
        --region "$AWS_REGION" \
        --query 'GroupId' \
        --output text)
    
    # Allow HTTP and HTTPS traffic
    aws ec2 authorize-security-group-ingress \
        --group-id "$ALB_SG_ID" \
        --protocol tcp \
        --port 80 \
        --cidr 0.0.0.0/0 \
        --region "$AWS_REGION"
    
    aws ec2 authorize-security-group-ingress \
        --group-id "$ALB_SG_ID" \
        --protocol tcp \
        --port 443 \
        --cidr 0.0.0.0.0/0 \
        --region "$AWS_REGION"
    
    # Create security group for ECS
    ECS_SG_ID=$(aws ec2 create-security-group \
        --group-name "${PROJECT_NAME}-ecs-sg" \
        --description "Security group for ECS tasks" \
        --vpc-id "$VPC_ID" \
        --region "$AWS_REGION" \
        --query 'GroupId' \
        --output text)
    
    # Allow traffic from ALB
    aws ec2 authorize-security-group-ingress \
        --group-id "$ECS_SG_ID" \
        --protocol tcp \
        --port 3000 \
        --source-group "$ALB_SG_ID" \
        --region "$AWS_REGION"
    
    # Create security group for RDS
    RDS_SG_ID=$(aws ec2 create-security-group \
        --group-name "${PROJECT_NAME}-rds-sg" \
        --description "Security group for RDS" \
        --vpc-id "$VPC_ID" \
        --region "$AWS_REGION" \
        --query 'GroupId' \
        --output text)
    
    # Allow traffic from ECS
    aws ec2 authorize-security-group-ingress \
        --group-id "$RDS_SG_ID" \
        --protocol tcp \
        --port 27017 \
        --source-group "$ECS_SG_ID" \
        --region "$AWS_REGION"
    
    print_success "Networking resources created"
}

# Function to create RDS instance
create_rds_instance() {
    print_status "Creating RDS instance..."
    
    # Generate database credentials
    DB_USERNAME="envfly_admin"
    DB_PASSWORD=$(openssl rand -base64 32)
    
    # Create RDS subnet group
    aws rds create-db-subnet-group \
        --db-subnet-group-name "${PROJECT_NAME}-subnet-group" \
        --db-subnet-group-description "Subnet group for ${PROJECT_NAME}" \
        --subnet-ids "$PRIVATE_SUBNET_ID" \
        --region "$AWS_REGION" 2>/dev/null || true
    
    # Create RDS instance
    aws rds create-db-instance \
        --db-instance-identifier "${PROJECT_NAME}-db" \
        --db-instance-class "$DB_INSTANCE_CLASS" \
        --engine mongodb \
        --allocated-storage "$DB_STORAGE_SIZE" \
        --master-username "$DB_USERNAME" \
        --master-user-password "$DB_PASSWORD" \
        --vpc-security-group-ids "$RDS_SG_ID" \
        --db-subnet-group-name "${PROJECT_NAME}-subnet-group" \
        --backup-retention-period 7 \
        --preferred-backup-window "03:00-04:00" \
        --preferred-maintenance-window "sun:04:00-sun:05:00" \
        --region "$AWS_REGION" \
        --storage-encrypted \
        --deletion-protection
    
    print_status "Waiting for RDS instance to be available..."
    aws rds wait db-instance-available \
        --db-instance-identifier "${PROJECT_NAME}-db" \
        --region "$AWS_REGION"
    
    # Get RDS endpoint
    RDS_ENDPOINT=$(aws rds describe-db-instances \
        --db-instance-identifier "${PROJECT_NAME}-db" \
        --region "$AWS_REGION" \
        --query 'DBInstances[0].Endpoint.Address' \
        --output text)
    
    print_success "RDS instance created: $RDS_ENDPOINT"
    
    # Save database credentials
    echo "DB_USERNAME=$DB_USERNAME" >> "$CONFIG_FILE"
    echo "DB_PASSWORD=$DB_PASSWORD" >> "$CONFIG_FILE"
    echo "RDS_ENDPOINT=$RDS_ENDPOINT" >> "$CONFIG_FILE"
}

# Function to create ECS cluster
create_ecs_cluster() {
    print_status "Creating ECS cluster..."
    
    aws ecs create-cluster \
        --cluster-name "$PROJECT_NAME" \
        --region "$AWS_REGION" \
        --capacity-providers FARGATE \
        --default-capacity-provider-strategy capacityProvider=FARGATE,weight=1
    
    print_success "ECS cluster created"
}

# Function to create task definition
create_task_definition() {
    print_status "Creating ECS task definition..."
    
    # Generate JWT secret
    JWT_SECRET=$(openssl rand -base64 64)
    
    # Create task definition JSON
    cat > /tmp/task-definition.json << EOF
{
    "family": "$PROJECT_NAME",
    "networkMode": "awsvpc",
    "requiresCompatibilities": ["FARGATE"],
    "cpu": "$CONTAINER_CPU",
    "memory": "$CONTAINER_MEMORY",
    "executionRoleArn": "ecsTaskExecutionRole",
    "containerDefinitions": [
        {
            "name": "$PROJECT_NAME",
            "image": "$ECR_REPO_URI:latest",
            "portMappings": [
                {
                    "containerPort": 3000,
                    "protocol": "tcp"
                }
            ],
            "environment": [
                {
                    "name": "NODE_ENV",
                    "value": "$ENVIRONMENT"
                },
                {
                    "name": "PORT",
                    "value": "3000"
                },
                {
                    "name": "MONGODB_URI",
                    "value": "mongodb://$DB_USERNAME:$DB_PASSWORD@$RDS_ENDPOINT:27017/envfly?authSource=admin"
                },
                {
                    "name": "JWT_SECRET",
                    "value": "$JWT_SECRET"
                },
                {
                    "name": "CORS_ORIGINS",
                    "value": "*"
                }
            ],
            "logConfiguration": {
                "logDriver": "awslogs",
                "options": {
                    "awslogs-group": "/ecs/$PROJECT_NAME",
                    "awslogs-region": "$AWS_REGION",
                    "awslogs-stream-prefix": "ecs"
                }
            },
            "healthCheck": {
                "command": ["CMD-SHELL", "curl -f http://localhost:3000/health || exit 1"],
                "interval": 30,
                "timeout": 5,
                "retries": 3,
                "startPeriod": 60
            }
        }
    ]
}
EOF
    
    # Register task definition
    aws ecs register-task-definition \
        --cli-input-json file:///tmp/task-definition.json \
        --region "$AWS_REGION"
    
    print_success "Task definition created"
}

# Function to create Application Load Balancer
create_load_balancer() {
    print_status "Creating Application Load Balancer..."
    
    # Create ALB
    ALB_ARN=$(aws elbv2 create-load-balancer \
        --name "${PROJECT_NAME}-alb" \
        --subnets "$PUBLIC_SUBNET_ID" \
        --security-groups "$ALB_SG_ID" \
        --region "$AWS_REGION" \
        --query 'LoadBalancers[0].LoadBalancerArn' \
        --output text)
    
    # Wait for ALB to be active
    aws elbv2 wait load-balancer-available \
        --load-balancer-arns "$ALB_ARN" \
        --region "$AWS_REGION"
    
    # Get ALB DNS name
    ALB_DNS=$(aws elbv2 describe-load-balancers \
        --load-balancer-arns "$ALB_ARN" \
        --region "$AWS_REGION" \
        --query 'LoadBalancers[0].DNSName' \
        --output text)
    
    # Create target group
    TARGET_GROUP_ARN=$(aws elbv2 create-target-group \
        --name "${PROJECT_NAME}-tg" \
        --protocol HTTP \
        --port 3000 \
        --vpc-id "$VPC_ID" \
        --target-type ip \
        --health-check-path "/health" \
        --health-check-interval-seconds 30 \
        --health-check-timeout-seconds 5 \
        --healthy-threshold-count 2 \
        --unhealthy-threshold-count 2 \
        --region "$AWS_REGION" \
        --query 'TargetGroups[0].TargetGroupArn' \
        --output text)
    
    # Create listener
    aws elbv2 create-listener \
        --load-balancer-arn "$ALB_ARN" \
        --protocol HTTP \
        --port 80 \
        --default-actions Type=forward,TargetGroupArn="$TARGET_GROUP_ARN" \
        --region "$AWS_REGION"
    
    print_success "Load balancer created: $ALB_DNS"
    
    # Save ALB information
    echo "ALB_DNS=$ALB_DNS" >> "$CONFIG_FILE"
    echo "TARGET_GROUP_ARN=$TARGET_GROUP_ARN" >> "$CONFIG_FILE"
}

# Function to create ECS service
create_ecs_service() {
    print_status "Creating ECS service..."
    
    aws ecs create-service \
        --cluster "$PROJECT_NAME" \
        --service-name "$PROJECT_NAME" \
        --task-definition "$PROJECT_NAME" \
        --desired-count "$DESIRED_COUNT" \
        --launch-type FARGATE \
        --network-configuration "awsvpcConfiguration={subnets=[$PRIVATE_SUBNET_ID],securityGroups=[$ECS_SG_ID],assignPublicIp=ENABLED}" \
        --load-balancers "targetGroupArn=$TARGET_GROUP_ARN,containerName=$PROJECT_NAME,containerPort=3000" \
        --region "$AWS_REGION"
    
    print_success "ECS service created"
}

# Function to create CloudWatch log group
create_log_group() {
    print_status "Creating CloudWatch log group..."
    
    aws logs create-log-group \
        --log-group-name "/ecs/$PROJECT_NAME" \
        --region "$AWS_REGION" 2>/dev/null || true
    
    print_success "Log group created"
}

# Function to display deployment information
display_deployment_info() {
    print_success "Deployment completed successfully!"
    echo ""
    echo "=========================================="
    echo "           DEPLOYMENT SUMMARY"
    echo "=========================================="
    echo "Project Name: $PROJECT_NAME"
    echo "Environment: $ENVIRONMENT"
    echo "Region: $AWS_REGION"
    echo ""
    echo "Application Load Balancer:"
    echo "  URL: http://$ALB_DNS"
    echo "  Health Check: http://$ALB_DNS/health"
    echo ""
    echo "Database:"
    echo "  Endpoint: $RDS_ENDPOINT"
    echo "  Username: $DB_USERNAME"
    echo "  Password: $DB_PASSWORD (saved in $CONFIG_FILE)"
    echo ""
    echo "Container Registry:"
    echo "  ECR Repository: $ECR_REPO_URI"
    echo ""
    echo "ECS Resources:"
    echo "  Cluster: $PROJECT_NAME"
    echo "  Service: $PROJECT_NAME"
    echo "  Task Definition: $PROJECT_NAME"
    echo ""
    echo "Configuration saved to: $CONFIG_FILE"
    echo ""
    echo "To update the deployment, run:"
    echo "  ./scripts/update-aws.sh"
    echo ""
    echo "To destroy the deployment, run:"
    echo "  ./scripts/destroy-aws.sh"
}

# Main deployment function
deploy() {
    print_status "Starting AWS deployment for $PROJECT_NAME..."
    
    # Pre-flight checks
    check_aws_cli
    check_docker
    check_aws_credentials
    
    # Get user input
    get_user_input
    
    # Create resources
    create_ecr_repository
    build_and_push_image
    create_networking
    create_rds_instance
    create_ecs_cluster
    create_log_group
    create_task_definition
    create_load_balancer
    create_ecs_service
    
    # Display results
    display_deployment_info
}

# Function to show help
show_help() {
    echo "EnvFly Backend AWS Deployment Script"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  -c, --config   Use existing configuration"
    echo ""
    echo "This script will:"
    echo "  1. Create ECR repository for Docker images"
    echo "  2. Build and push the Docker image"
    echo "  3. Create VPC, subnets, and security groups"
    echo "  4. Create RDS MongoDB instance"
    echo "  5. Create ECS cluster and service"
    echo "  6. Create Application Load Balancer"
    echo "  7. Deploy the application"
    echo ""
    echo "Prerequisites:"
    echo "  - AWS CLI installed and configured"
    echo "  - Docker installed"
    echo "  - Appropriate AWS permissions"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -c|--config)
            USE_EXISTING_CONFIG=true
            shift
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Run deployment
deploy 