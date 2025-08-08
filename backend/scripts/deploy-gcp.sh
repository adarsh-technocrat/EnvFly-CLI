#!/bin/bash

# EnvFly Backend GCP Deployment Script
# This script deploys the EnvFly backend to GCP using Cloud Run and Firestore

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
CONFIG_FILE="$PROJECT_DIR/.gcp-config"

# Default values
PROJECT_NAME="envfly-backend"
GCP_PROJECT_ID=""
GCP_REGION="us-central1"
ENVIRONMENT="production"
CONTAINER_CPU="1"
CONTAINER_MEMORY="512Mi"
MAX_INSTANCES="10"

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

# Function to check if gcloud CLI is installed
check_gcloud_cli() {
    if ! command -v gcloud &> /dev/null; then
        print_error "Google Cloud CLI is not installed. Please install it first."
        print_status "Installation guide: https://cloud.google.com/sdk/docs/install"
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

# Function to check GCP authentication
check_gcp_auth() {
    if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
        print_error "Not authenticated with GCP. Please run 'gcloud auth login' first."
        exit 1
    fi
}

# Function to get user input
get_user_input() {
    print_status "GCP Deployment Configuration"
    echo "=================================="
    
    # Get current project if not set
    if [ -z "$GCP_PROJECT_ID" ]; then
        CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null || echo "")
        read -p "GCP Project ID [$CURRENT_PROJECT]: " input_project_id
        GCP_PROJECT_ID=${input_project_id:-$CURRENT_PROJECT}
    else
        read -p "GCP Project ID [$GCP_PROJECT_ID]: " input_project_id
        GCP_PROJECT_ID=${input_project_id:-$GCP_PROJECT_ID}
    fi
    
    read -p "Project name [$PROJECT_NAME]: " input_project_name
    PROJECT_NAME=${input_project_name:-$PROJECT_NAME}
    
    read -p "GCP Region [$GCP_REGION]: " input_region
    GCP_REGION=${input_region:-$GCP_REGION}
    
    read -p "Environment [$ENVIRONMENT]: " input_env
    ENVIRONMENT=${input_env:-$ENVIRONMENT}
    
    read -p "Container CPU cores [$CONTAINER_CPU]: " input_cpu
    CONTAINER_CPU=${input_cpu:-$CONTAINER_CPU}
    
    read -p "Container memory [$CONTAINER_MEMORY]: " input_memory
    CONTAINER_MEMORY=${input_memory:-$CONTAINER_MEMORY}
    
    read -p "Max instances [$MAX_INSTANCES]: " input_max_instances
    MAX_INSTANCES=${input_max_instances:-$MAX_INSTANCES}
    
    # Save configuration
    cat > "$CONFIG_FILE" << EOF
PROJECT_NAME="$PROJECT_NAME"
GCP_PROJECT_ID="$GCP_PROJECT_ID"
GCP_REGION="$GCP_REGION"
ENVIRONMENT="$ENVIRONMENT"
CONTAINER_CPU="$CONTAINER_CPU"
CONTAINER_MEMORY="$CONTAINER_MEMORY"
MAX_INSTANCES="$MAX_INSTANCES"
EOF
}

# Function to set GCP project
set_gcp_project() {
    print_status "Setting GCP project..."
    
    gcloud config set project "$GCP_PROJECT_ID"
    
    print_success "GCP project set to: $GCP_PROJECT_ID"
}

# Function to enable required APIs
enable_apis() {
    print_status "Enabling required GCP APIs..."
    
    # Enable Cloud Run API
    gcloud services enable run.googleapis.com
    
    # Enable Container Registry API
    gcloud services enable containerregistry.googleapis.com
    
    # Enable Cloud Build API
    gcloud services enable cloudbuild.googleapis.com
    
    # Enable Firestore API
    gcloud services enable firestore.googleapis.com
    
    # Enable Cloud Logging API
    gcloud services enable logging.googleapis.com
    
    # Enable Cloud Monitoring API
    gcloud services enable monitoring.googleapis.com
    
    # Enable Secret Manager API
    gcloud services enable secretmanager.googleapis.com
    
    print_success "Required APIs enabled"
}

# Function to configure Docker for GCP
configure_docker() {
    print_status "Configuring Docker for GCP..."
    
    # Configure Docker to use gcloud as a credential helper
    gcloud auth configure-docker
    
    print_success "Docker configured for GCP"
}

# Function to build and push Docker image
build_and_push_image() {
    print_status "Building and pushing Docker image..."
    
    # Build and push using Cloud Build
    gcloud builds submit \
        --tag "gcr.io/$GCP_PROJECT_ID/$PROJECT_NAME" \
        --project "$GCP_PROJECT_ID" \
        "$PROJECT_DIR"
    
    IMAGE_URL="gcr.io/$GCP_PROJECT_ID/$PROJECT_NAME"
    
    print_success "Docker image built and pushed: $IMAGE_URL"
    
    # Save image URL
    echo "IMAGE_URL=$IMAGE_URL" >> "$CONFIG_FILE"
}

# Function to create Firestore database
create_firestore() {
    print_status "Creating Firestore database..."
    
    # Create Firestore database in native mode
    gcloud firestore databases create \
        --project "$GCP_PROJECT_ID" \
        --region "$GCP_REGION" \
        --type firestore-native 2>/dev/null || true
    
    print_success "Firestore database created"
}

# Function to create secrets
create_secrets() {
    print_status "Creating secrets in Secret Manager..."
    
    # Generate JWT secret
    JWT_SECRET=$(openssl rand -base64 64)
    
    # Create JWT secret
    echo "$JWT_SECRET" | gcloud secrets create "${PROJECT_NAME}-jwt-secret" \
        --data-file=- \
        --replication-policy="automatic" \
        --project "$GCP_PROJECT_ID" 2>/dev/null || \
    echo "$JWT_SECRET" | gcloud secrets versions add "${PROJECT_NAME}-jwt-secret" \
        --data-file=- \
        --project "$GCP_PROJECT_ID"
    
    # Create MongoDB URI secret (using Firestore instead)
    MONGODB_URI="mongodb://localhost:27017/envfly"
    echo "$MONGODB_URI" | gcloud secrets create "${PROJECT_NAME}-mongodb-uri" \
        --data-file=- \
        --replication-policy="automatic" \
        --project "$GCP_PROJECT_ID" 2>/dev/null || \
    echo "$MONGODB_URI" | gcloud secrets versions add "${PROJECT_NAME}-mongodb-uri" \
        --data-file=- \
        --project "$GCP_PROJECT_ID"
    
    print_success "Secrets created in Secret Manager"
    
    # Save secret names
    echo "JWT_SECRET_NAME=${PROJECT_NAME}-jwt-secret" >> "$CONFIG_FILE"
    echo "MONGODB_URI_NAME=${PROJECT_NAME}-mongodb-uri" >> "$CONFIG_FILE"
}

# Function to create service account
create_service_account() {
    print_status "Creating service account..."
    
    SERVICE_ACCOUNT_NAME="${PROJECT_NAME}-sa"
    SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${GCP_PROJECT_ID}.iam.gserviceaccount.com"
    
    # Create service account
    gcloud iam service-accounts create "$SERVICE_ACCOUNT_NAME" \
        --display-name="EnvFly Backend Service Account" \
        --project "$GCP_PROJECT_ID" 2>/dev/null || true
    
    # Grant Secret Manager access
    gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
        --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
        --role="roles/secretmanager.secretAccessor"
    
    # Grant Firestore access
    gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
        --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
        --role="roles/datastore.user"
    
    # Grant Cloud Logging access
    gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
        --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
        --role="roles/logging.logWriter"
    
    print_success "Service account created: $SERVICE_ACCOUNT_EMAIL"
    
    # Save service account information
    echo "SERVICE_ACCOUNT_NAME=$SERVICE_ACCOUNT_NAME" >> "$CONFIG_FILE"
    echo "SERVICE_ACCOUNT_EMAIL=$SERVICE_ACCOUNT_EMAIL" >> "$CONFIG_FILE"
}

# Function to deploy to Cloud Run
deploy_to_cloud_run() {
    print_status "Deploying to Cloud Run..."
    
    # Deploy the service
    gcloud run deploy "$PROJECT_NAME" \
        --image "gcr.io/$GCP_PROJECT_ID/$PROJECT_NAME" \
        --platform managed \
        --region "$GCP_REGION" \
        --project "$GCP_PROJECT_ID" \
        --service-account "$SERVICE_ACCOUNT_EMAIL" \
        --cpu "$CONTAINER_CPU" \
        --memory "$CONTAINER_MEMORY" \
        --max-instances "$MAX_INSTANCES" \
        --min-instances 0 \
        --port 3000 \
        --set-env-vars "NODE_ENV=$ENVIRONMENT,PORT=3000,CORS_ORIGINS=*" \
        --set-secrets "JWT_SECRET=${PROJECT_NAME}-jwt-secret:latest,MONGODB_URI=${PROJECT_NAME}-mongodb-uri:latest" \
        --allow-unauthenticated \
        --ingress all \
        --timeout 300 \
        --concurrency 80 \
        --cpu-throttling \
        --execution-environment gen2
    
    # Get service URL
    SERVICE_URL=$(gcloud run services describe "$PROJECT_NAME" \
        --region "$GCP_REGION" \
        --project "$GCP_PROJECT_ID" \
        --format="value(status.url)")
    
    print_success "Service deployed to Cloud Run: $SERVICE_URL"
    
    # Save service URL
    echo "SERVICE_URL=$SERVICE_URL" >> "$CONFIG_FILE"
}

# Function to create custom domain (optional)
create_custom_domain() {
    read -p "Do you want to set up a custom domain? (y/N): " setup_domain
    if [[ $setup_domain =~ ^[Yy]$ ]]; then
        read -p "Enter your custom domain (e.g., api.yourdomain.com): " CUSTOM_DOMAIN
        
        if [ ! -z "$CUSTOM_DOMAIN" ]; then
            print_status "Setting up custom domain: $CUSTOM_DOMAIN"
            
            # Map custom domain to Cloud Run service
            gcloud run domain-mappings create \
                --service "$PROJECT_NAME" \
                --domain "$CUSTOM_DOMAIN" \
                --region "$GCP_REGION" \
                --project "$GCP_PROJECT_ID"
            
            print_success "Custom domain mapped: $CUSTOM_DOMAIN"
            
            # Save custom domain
            echo "CUSTOM_DOMAIN=$CUSTOM_DOMAIN" >> "$CONFIG_FILE"
        fi
    fi
}

# Function to set up monitoring
setup_monitoring() {
    print_status "Setting up monitoring and alerting..."
    
    # Create log-based alert for errors
    gcloud logging metrics create "${PROJECT_NAME}-error-rate" \
        --description="Error rate for $PROJECT_NAME" \
        --log-filter="resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"$PROJECT_NAME\" AND severity>=ERROR" \
        --project "$GCP_PROJECT_ID" 2>/dev/null || true
    
    # Create uptime check
    gcloud monitoring uptime-checks create http "${PROJECT_NAME}-health-check" \
        --uri="$SERVICE_URL/health" \
        --display-name="Health check for $PROJECT_NAME" \
        --project "$GCP_PROJECT_ID" 2>/dev/null || true
    
    print_success "Monitoring and alerting configured"
}

# Function to display deployment information
display_deployment_info() {
    print_success "Deployment completed successfully!"
    echo ""
    echo "=========================================="
    echo "           DEPLOYMENT SUMMARY"
    echo "=========================================="
    echo "Project Name: $PROJECT_NAME"
    echo "GCP Project: $GCP_PROJECT_ID"
    echo "Environment: $ENVIRONMENT"
    echo "Region: $GCP_REGION"
    echo ""
    echo "Application URLs:"
    echo "  Cloud Run: $SERVICE_URL"
    echo "  Health Check: $SERVICE_URL/health"
    if [ ! -z "$CUSTOM_DOMAIN" ]; then
        echo "  Custom Domain: https://$CUSTOM_DOMAIN"
    fi
    echo ""
    echo "Database:"
    echo "  Firestore: Native mode in $GCP_REGION"
    echo "  Database: envfly"
    echo ""
    echo "Container Registry:"
    echo "  Image: gcr.io/$GCP_PROJECT_ID/$PROJECT_NAME"
    echo ""
    echo "Secrets:"
    echo "  JWT Secret: ${PROJECT_NAME}-jwt-secret"
    echo "  MongoDB URI: ${PROJECT_NAME}-mongodb-uri"
    echo ""
    echo "Service Account:"
    echo "  Email: $SERVICE_ACCOUNT_EMAIL"
    echo ""
    echo "Configuration saved to: $CONFIG_FILE"
    echo ""
    echo "To update the deployment, run:"
    echo "  ./scripts/update-gcp.sh"
    echo ""
    echo "To destroy the deployment, run:"
    echo "  ./scripts/destroy-gcp.sh"
    echo ""
    echo "To view logs, run:"
    echo "  gcloud logs tail --service=$PROJECT_NAME --project=$GCP_PROJECT_ID"
}

# Main deployment function
deploy() {
    print_status "Starting GCP deployment for $PROJECT_NAME..."
    
    # Pre-flight checks
    check_gcloud_cli
    check_docker
    check_gcp_auth
    
    # Get user input
    get_user_input
    
    # Set up GCP project
    set_gcp_project
    
    # Create resources
    enable_apis
    configure_docker
    build_and_push_image
    create_firestore
    create_secrets
    create_service_account
    deploy_to_cloud_run
    setup_monitoring
    
    # Optional: Create custom domain
    create_custom_domain
    
    # Display results
    display_deployment_info
}

# Function to show help
show_help() {
    echo "EnvFly Backend GCP Deployment Script"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  -c, --config   Use existing configuration"
    echo ""
    echo "This script will:"
    echo "  1. Enable required GCP APIs"
    echo "  2. Build and push Docker image to Container Registry"
    echo "  3. Create Firestore database"
    echo "  4. Create secrets in Secret Manager"
    echo "  5. Create service account with appropriate permissions"
    echo "  6. Deploy to Cloud Run"
    echo "  7. Set up monitoring and alerting"
    echo "  8. Optionally configure custom domain"
    echo ""
    echo "Prerequisites:"
    echo "  - Google Cloud CLI installed and configured"
    echo "  - Docker installed"
    echo "  - GCP project with billing enabled"
    echo "  - Appropriate GCP permissions"
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