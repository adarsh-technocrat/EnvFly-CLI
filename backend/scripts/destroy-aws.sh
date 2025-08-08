#!/bin/bash

# EnvFly Backend AWS Destroy Script
# This script destroys all AWS resources created by the deployment

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

# Load configuration
if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${RED}[ERROR]${NC} Configuration file not found. Nothing to destroy."
    exit 1
fi

source "$CONFIG_FILE"

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

# Function to confirm destruction
confirm_destruction() {
    echo ""
    echo -e "${RED}⚠️  WARNING: This will destroy ALL resources! ⚠️${NC}"
    echo ""
    echo "The following resources will be deleted:"
    echo "  - ECS Cluster: $PROJECT_NAME"
    echo "  - ECS Service: $PROJECT_NAME"
    echo "  - Application Load Balancer: ${PROJECT_NAME}-alb"
    echo "  - RDS Instance: ${PROJECT_NAME}-db"
    echo "  - ECR Repository: $PROJECT_NAME"
    echo "  - VPC and all networking resources"
    echo "  - All associated security groups and subnets"
    echo ""
    echo -e "${RED}This action cannot be undone!${NC}"
    echo ""
    read -p "Are you sure you want to continue? Type 'DESTROY' to confirm: " confirmation
    
    if [ "$confirmation" != "DESTROY" ]; then
        print_status "Destruction cancelled."
        exit 0
    fi
}

# Function to destroy ECS service
destroy_ecs_service() {
    print_status "Destroying ECS service..."
    
    # Scale down to 0 tasks
    aws ecs update-service \
        --cluster "$PROJECT_NAME" \
        --service "$PROJECT_NAME" \
        --desired-count 0 \
        --region "$AWS_REGION" 2>/dev/null || true
    
    # Wait for tasks to stop
    aws ecs wait services-stable \
        --cluster "$PROJECT_NAME" \
        --services "$PROJECT_NAME" \
        --region "$AWS_REGION" 2>/dev/null || true
    
    # Delete service
    aws ecs delete-service \
        --cluster "$PROJECT_NAME" \
        --service "$PROJECT_NAME" \
        --force \
        --region "$AWS_REGION" 2>/dev/null || true
    
    print_success "ECS service destroyed"
}

# Function to destroy ECS cluster
destroy_ecs_cluster() {
    print_status "Destroying ECS cluster..."
    
    aws ecs delete-cluster \
        --cluster "$PROJECT_NAME" \
        --region "$AWS_REGION" 2>/dev/null || true
    
    print_success "ECS cluster destroyed"
}

# Function to destroy Application Load Balancer
destroy_load_balancer() {
    print_status "Destroying Application Load Balancer..."
    
    # Get ALB ARN
    ALB_ARN=$(aws elbv2 describe-load-balancers \
        --names "${PROJECT_NAME}-alb" \
        --region "$AWS_REGION" \
        --query 'LoadBalancers[0].LoadBalancerArn' \
        --output text 2>/dev/null || echo "")
    
    if [ ! -z "$ALB_ARN" ] && [ "$ALB_ARN" != "None" ]; then
        # Delete ALB
        aws elbv2 delete-load-balancer \
            --load-balancer-arn "$ALB_ARN" \
            --region "$AWS_REGION" 2>/dev/null || true
        
        # Wait for ALB to be deleted
        aws elbv2 wait load-balancers-deleted \
            --load-balancer-arns "$ALB_ARN" \
            --region "$AWS_REGION" 2>/dev/null || true
    fi
    
    print_success "Application Load Balancer destroyed"
}

# Function to destroy target group
destroy_target_group() {
    print_status "Destroying target group..."
    
    # Get target group ARN
    TARGET_GROUP_ARN=$(aws elbv2 describe-target-groups \
        --names "${PROJECT_NAME}-tg" \
        --region "$AWS_REGION" \
        --query 'TargetGroups[0].TargetGroupArn' \
        --output text 2>/dev/null || echo "")
    
    if [ ! -z "$TARGET_GROUP_ARN" ] && [ "$TARGET_GROUP_ARN" != "None" ]; then
        aws elbv2 delete-target-group \
            --target-group-arn "$TARGET_GROUP_ARN" \
            --region "$AWS_REGION" 2>/dev/null || true
    fi
    
    print_success "Target group destroyed"
}

# Function to destroy RDS instance
destroy_rds_instance() {
    print_status "Destroying RDS instance..."
    
    # Delete RDS instance
    aws rds delete-db-instance \
        --db-instance-identifier "${PROJECT_NAME}-db" \
        --skip-final-snapshot \
        --delete-automated-backups \
        --region "$AWS_REGION" 2>/dev/null || true
    
    # Wait for RDS instance to be deleted
    aws rds wait db-instance-deleted \
        --db-instance-identifier "${PROJECT_NAME}-db" \
        --region "$AWS_REGION" 2>/dev/null || true
    
    # Delete subnet group
    aws rds delete-db-subnet-group \
        --db-subnet-group-name "${PROJECT_NAME}-subnet-group" \
        --region "$AWS_REGION" 2>/dev/null || true
    
    print_success "RDS instance destroyed"
}

# Function to destroy ECR repository
destroy_ecr_repository() {
    print_status "Destroying ECR repository..."
    
    # Delete all images first
    aws ecr batch-delete-image \
        --repository-name "$PROJECT_NAME" \
        --image-ids "$(aws ecr list-images --repository-name "$PROJECT_NAME" --region "$AWS_REGION" --query 'imageIds' --output json)" \
        --region "$AWS_REGION" 2>/dev/null || true
    
    # Delete repository
    aws ecr delete-repository \
        --repository-name "$PROJECT_NAME" \
        --force \
        --region "$AWS_REGION" 2>/dev/null || true
    
    print_success "ECR repository destroyed"
}

# Function to destroy VPC and networking
destroy_networking() {
    print_status "Destroying VPC and networking resources..."
    
    # Get VPC ID
    VPC_ID=$(aws ec2 describe-vpcs \
        --filters "Name=tag:Name,Values=*$PROJECT_NAME*" \
        --region "$AWS_REGION" \
        --query 'Vpcs[0].VpcId' \
        --output text 2>/dev/null || echo "")
    
    if [ ! -z "$VPC_ID" ] && [ "$VPC_ID" != "None" ]; then
        # Get subnet IDs
        SUBNET_IDS=$(aws ec2 describe-subnets \
            --filters "Name=vpc-id,Values=$VPC_ID" \
            --region "$AWS_REGION" \
            --query 'Subnets[*].SubnetId' \
            --output text 2>/dev/null || echo "")
        
        # Get security group IDs
        SG_IDS=$(aws ec2 describe-security-groups \
            --filters "Name=vpc-id,Values=$VPC_ID" \
            --region "$AWS_REGION" \
            --query 'SecurityGroups[*].GroupId' \
            --output text 2>/dev/null || echo "")
        
        # Get route table IDs
        ROUTE_TABLE_IDS=$(aws ec2 describe-route-tables \
            --filters "Name=vpc-id,Values=$VPC_ID" \
            --region "$AWS_REGION" \
            --query 'RouteTables[*].RouteTableId' \
            --output text 2>/dev/null || echo "")
        
        # Get internet gateway ID
        IGW_ID=$(aws ec2 describe-internet-gateways \
            --filters "Name=attachment.vpc-id,Values=$VPC_ID" \
            --region "$AWS_REGION" \
            --query 'InternetGateways[0].InternetGatewayId' \
            --output text 2>/dev/null || echo "")
        
        # Delete subnets
        for SUBNET_ID in $SUBNET_IDS; do
            if [ ! -z "$SUBNET_ID" ] && [ "$SUBNET_ID" != "None" ]; then
                aws ec2 delete-subnet --subnet-id "$SUBNET_ID" --region "$AWS_REGION" 2>/dev/null || true
            fi
        done
        
        # Delete route tables
        for ROUTE_TABLE_ID in $ROUTE_TABLE_IDS; do
            if [ ! -z "$ROUTE_TABLE_ID" ] && [ "$ROUTE_TABLE_ID" != "None" ]; then
                aws ec2 delete-route-table --route-table-id "$ROUTE_TABLE_ID" --region "$AWS_REGION" 2>/dev/null || true
            fi
        done
        
        # Detach and delete internet gateway
        if [ ! -z "$IGW_ID" ] && [ "$IGW_ID" != "None" ]; then
            aws ec2 detach-internet-gateway --internet-gateway-id "$IGW_ID" --vpc-id "$VPC_ID" --region "$AWS_REGION" 2>/dev/null || true
            aws ec2 delete-internet-gateway --internet-gateway-id "$IGW_ID" --region "$AWS_REGION" 2>/dev/null || true
        fi
        
        # Delete security groups
        for SG_ID in $SG_IDS; do
            if [ ! -z "$SG_ID" ] && [ "$SG_ID" != "None" ]; then
                aws ec2 delete-security-group --group-id "$SG_ID" --region "$AWS_REGION" 2>/dev/null || true
            fi
        done
        
        # Delete VPC
        aws ec2 delete-vpc --vpc-id "$VPC_ID" --region "$AWS_REGION" 2>/dev/null || true
    fi
    
    print_success "VPC and networking resources destroyed"
}

# Function to clean up configuration
cleanup_config() {
    print_status "Cleaning up configuration..."
    
    # Remove configuration file
    rm -f "$CONFIG_FILE"
    
    print_success "Configuration cleaned up"
}

# Main destroy function
destroy() {
    print_status "Starting AWS resource destruction for $PROJECT_NAME..."
    
    # Confirm destruction
    confirm_destruction
    
    # Destroy resources in reverse order
    destroy_ecs_service
    destroy_ecs_cluster
    destroy_load_balancer
    destroy_target_group
    destroy_rds_instance
    destroy_ecr_repository
    destroy_networking
    cleanup_config
    
    print_success "All AWS resources destroyed successfully!"
    echo ""
    echo "If you want to redeploy, run:"
    echo "  ./scripts/deploy-aws.sh"
}

# Run destroy
destroy 