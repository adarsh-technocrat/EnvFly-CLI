#!/bin/bash

# EnvFly Backend AWS Update Script
# This script updates the existing AWS deployment with new changes

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
    echo -e "${RED}[ERROR]${NC} Configuration file not found. Please run deploy-aws.sh first."
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

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to build and push new image
update_docker_image() {
    print_status "Building and pushing new Docker image..."
    
    # Get ECR login token
    aws ecr get-login-password --region "$AWS_REGION" | \
        docker login --username AWS --password-stdin "$ECR_REPO_URI"
    
    # Build new image
    docker build -t "$PROJECT_NAME" "$PROJECT_DIR"
    
    # Tag with timestamp for versioning
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    docker tag "$PROJECT_NAME:latest" "$ECR_REPO_URI:$TIMESTAMP"
    docker tag "$PROJECT_NAME:latest" "$ECR_REPO_URI:latest"
    
    # Push images
    docker push "$ECR_REPO_URI:$TIMESTAMP"
    docker push "$ECR_REPO_URI:latest"
    
    print_success "New Docker image pushed: $ECR_REPO_URI:$TIMESTAMP"
}

# Function to update ECS service
update_ecs_service() {
    print_status "Updating ECS service..."
    
    # Force new deployment
    aws ecs update-service \
        --cluster "$PROJECT_NAME" \
        --service "$PROJECT_NAME" \
        --force-new-deployment \
        --region "$AWS_REGION"
    
    print_status "Waiting for service to stabilize..."
    aws ecs wait services-stable \
        --cluster "$PROJECT_NAME" \
        --services "$PROJECT_NAME" \
        --region "$AWS_REGION"
    
    print_success "ECS service updated successfully"
}

# Function to check deployment health
check_health() {
    print_status "Checking deployment health..."
    
    # Wait a moment for the service to be ready
    sleep 30
    
    # Check health endpoint
    if curl -f "http://$ALB_DNS/health" > /dev/null 2>&1; then
        print_success "Health check passed"
    else
        print_error "Health check failed"
        exit 1
    fi
}

# Main update function
update() {
    print_status "Starting AWS update for $PROJECT_NAME..."
    
    update_docker_image
    update_ecs_service
    check_health
    
    print_success "Update completed successfully!"
    echo ""
    echo "Updated service is available at: http://$ALB_DNS"
    echo "Health check: http://$ALB_DNS/health"
}

# Run update
update 