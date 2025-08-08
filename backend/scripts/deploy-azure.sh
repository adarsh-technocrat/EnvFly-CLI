#!/bin/bash

# EnvFly Backend Azure Deployment Script
# This script deploys the EnvFly backend to Azure using Container Instances and Cosmos DB

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
CONFIG_FILE="$PROJECT_DIR/.azure-config"

# Default values
PROJECT_NAME="envfly-backend"
RESOURCE_GROUP="envfly-rg"
LOCATION="eastus"
ENVIRONMENT="production"
CONTAINER_CPU="1"
CONTAINER_MEMORY="2"
DB_TIER="M0"

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

# Function to check if Azure CLI is installed
check_azure_cli() {
    if ! command -v az &> /dev/null; then
        print_error "Azure CLI is not installed. Please install it first."
        print_status "Installation guide: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
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

# Function to check Azure login
check_azure_login() {
    if ! az account show &> /dev/null; then
        print_error "Not logged into Azure. Please run 'az login' first."
        exit 1
    fi
}

# Function to get user input
get_user_input() {
    print_status "Azure Deployment Configuration"
    echo "==================================="
    
    read -p "Project name [$PROJECT_NAME]: " input_project_name
    PROJECT_NAME=${input_project_name:-$PROJECT_NAME}
    
    read -p "Resource group name [$RESOURCE_GROUP]: " input_rg
    RESOURCE_GROUP=${input_rg:-$RESOURCE_GROUP}
    
    read -p "Azure region [$LOCATION]: " input_location
    LOCATION=${input_location:-$LOCATION}
    
    read -p "Environment [$ENVIRONMENT]: " input_env
    ENVIRONMENT=${input_env:-$ENVIRONMENT}
    
    read -p "Container CPU cores [$CONTAINER_CPU]: " input_cpu
    CONTAINER_CPU=${input_cpu:-$CONTAINER_CPU}
    
    read -p "Container memory (GB) [$CONTAINER_MEMORY]: " input_memory
    CONTAINER_MEMORY=${input_memory:-$CONTAINER_MEMORY}
    
    read -p "Database tier (M0/M10/M20/M30) [$DB_TIER]: " input_db_tier
    DB_TIER=${input_db_tier:-$DB_TIER}
    
    # Save configuration
    cat > "$CONFIG_FILE" << EOF
PROJECT_NAME="$PROJECT_NAME"
RESOURCE_GROUP="$RESOURCE_GROUP"
LOCATION="$LOCATION"
ENVIRONMENT="$ENVIRONMENT"
CONTAINER_CPU="$CONTAINER_CPU"
CONTAINER_MEMORY="$CONTAINER_MEMORY"
DB_TIER="$DB_TIER"
EOF
}

# Function to create resource group
create_resource_group() {
    print_status "Creating resource group..."
    
    az group create \
        --name "$RESOURCE_GROUP" \
        --location "$LOCATION" \
        --output none
    
    print_success "Resource group created: $RESOURCE_GROUP"
}

# Function to create Container Registry
create_container_registry() {
    print_status "Creating Azure Container Registry..."
    
    REGISTRY_NAME="${PROJECT_NAME}acr"
    
    az acr create \
        --resource-group "$RESOURCE_GROUP" \
        --name "$REGISTRY_NAME" \
        --sku Basic \
        --admin-enabled true \
        --output none
    
    # Get registry credentials
    REGISTRY_LOGIN_SERVER=$(az acr show \
        --name "$REGISTRY_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --query loginServer \
        --output tsv)
    
    REGISTRY_USERNAME=$(az acr credential show \
        --name "$REGISTRY_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --query username \
        --output tsv)
    
    REGISTRY_PASSWORD=$(az acr credential show \
        --name "$REGISTRY_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --query passwords[0].value \
        --output tsv)
    
    print_success "Container registry created: $REGISTRY_LOGIN_SERVER"
    
    # Save registry information
    echo "REGISTRY_NAME=$REGISTRY_NAME" >> "$CONFIG_FILE"
    echo "REGISTRY_LOGIN_SERVER=$REGISTRY_LOGIN_SERVER" >> "$CONFIG_FILE"
    echo "REGISTRY_USERNAME=$REGISTRY_USERNAME" >> "$CONFIG_FILE"
    echo "REGISTRY_PASSWORD=$REGISTRY_PASSWORD" >> "$CONFIG_FILE"
}

# Function to build and push Docker image
build_and_push_image() {
    print_status "Building and pushing Docker image..."
    
    # Login to registry
    az acr login --name "$REGISTRY_NAME" --resource-group "$RESOURCE_GROUP"
    
    # Build image
    docker build -t "$PROJECT_NAME" "$PROJECT_DIR"
    
    # Tag image
    docker tag "$PROJECT_NAME:latest" "$REGISTRY_LOGIN_SERVER/$PROJECT_NAME:latest"
    
    # Push image
    docker push "$REGISTRY_LOGIN_SERVER/$PROJECT_NAME:latest"
    
    print_success "Docker image pushed successfully"
}

# Function to create Cosmos DB account
create_cosmos_db() {
    print_status "Creating Cosmos DB account..."
    
    COSMOS_ACCOUNT_NAME="${PROJECT_NAME}cosmos"
    
    az cosmosdb create \
        --name "$COSMOS_ACCOUNT_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --kind MongoDB \
        --capabilities EnableMongo \
        --output none
    
    # Get connection string
    COSMOS_CONNECTION_STRING=$(az cosmosdb keys list \
        --name "$COSMOS_ACCOUNT_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --type connection-strings \
        --query connectionStrings[0].connectionString \
        --output tsv)
    
    # Create database
    az cosmosdb mongodb database create \
        --account-name "$COSMOS_ACCOUNT_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --name envfly \
        --output none
    
    print_success "Cosmos DB account created: $COSMOS_ACCOUNT_NAME"
    
    # Save Cosmos DB information
    echo "COSMOS_ACCOUNT_NAME=$COSMOS_ACCOUNT_NAME" >> "$CONFIG_FILE"
    echo "COSMOS_CONNECTION_STRING=$COSMOS_CONNECTION_STRING" >> "$CONFIG_FILE"
}

# Function to create Application Insights
create_app_insights() {
    print_status "Creating Application Insights..."
    
    APP_INSIGHTS_NAME="${PROJECT_NAME}-insights"
    
    az monitor app-insights component create \
        --app "$APP_INSIGHTS_NAME" \
        --location "$LOCATION" \
        --resource-group "$RESOURCE_GROUP" \
        --application-type web \
        --output none
    
    # Get instrumentation key
    INSTRUMENTATION_KEY=$(az monitor app-insights component show \
        --app "$APP_INSIGHTS_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --query instrumentationKey \
        --output tsv)
    
    print_success "Application Insights created: $APP_INSIGHTS_NAME"
    
    # Save App Insights information
    echo "APP_INSIGHTS_NAME=$APP_INSIGHTS_NAME" >> "$CONFIG_FILE"
    echo "INSTRUMENTATION_KEY=$INSTRUMENTATION_KEY" >> "$CONFIG_FILE"
}

# Function to create Container Instance
create_container_instance() {
    print_status "Creating Container Instance..."
    
    # Generate JWT secret
    JWT_SECRET=$(openssl rand -base64 64)
    
    # Create container instance
    az container create \
        --resource-group "$RESOURCE_GROUP" \
        --name "$PROJECT_NAME" \
        --image "$REGISTRY_LOGIN_SERVER/$PROJECT_NAME:latest" \
        --cpu "$CONTAINER_CPU" \
        --memory "$CONTAINER_MEMORY" \
        --ports 3000 \
        --dns-name-label "$PROJECT_NAME" \
        --environment-variables \
            NODE_ENV="$ENVIRONMENT" \
            PORT="3000" \
            MONGODB_URI="$COSMOS_CONNECTION_STRING" \
            JWT_SECRET="$JWT_SECRET" \
            CORS_ORIGINS="*" \
        --registry-login-server "$REGISTRY_LOGIN_SERVER" \
        --registry-username "$REGISTRY_USERNAME" \
        --registry-password "$REGISTRY_PASSWORD" \
        --output none
    
    # Get container instance FQDN
    CONTAINER_FQDN=$(az container show \
        --resource-group "$RESOURCE_GROUP" \
        --name "$PROJECT_NAME" \
        --query ipAddress.fqdn \
        --output tsv)
    
    print_success "Container instance created: $CONTAINER_FQDN"
    
    # Save container information
    echo "CONTAINER_FQDN=$CONTAINER_FQDN" >> "$CONFIG_FILE"
    echo "JWT_SECRET=$JWT_SECRET" >> "$CONFIG_FILE"
}

# Function to create Azure Front Door (optional)
create_front_door() {
    print_status "Creating Azure Front Door for global distribution..."
    
    FRONT_DOOR_NAME="${PROJECT_NAME}-fd"
    
    az network front-door create \
        --resource-group "$RESOURCE_GROUP" \
        --name "$FRONT_DOOR_NAME" \
        --backend-address "$CONTAINER_FQDN" \
        --output none
    
    # Get Front Door hostname
    FRONT_DOOR_HOSTNAME=$(az network front-door show \
        --resource-group "$RESOURCE_GROUP" \
        --name "$FRONT_DOOR_NAME" \
        --query frontendEndpoints[0].hostName \
        --output tsv)
    
    print_success "Front Door created: $FRONT_DOOR_HOSTNAME"
    
    # Save Front Door information
    echo "FRONT_DOOR_NAME=$FRONT_DOOR_NAME" >> "$CONFIG_FILE"
    echo "FRONT_DOOR_HOSTNAME=$FRONT_DOOR_HOSTNAME" >> "$CONFIG_FILE"
}

# Function to create Key Vault for secrets
create_key_vault() {
    print_status "Creating Key Vault for secrets management..."
    
    KEY_VAULT_NAME="${PROJECT_NAME}kv"
    
    # Get current user object ID
    USER_OBJECT_ID=$(az ad signed-in-user show --query objectId --output tsv)
    
    # Create Key Vault
    az keyvault create \
        --name "$KEY_VAULT_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --location "$LOCATION" \
        --enabled-for-deployment true \
        --enabled-for-disk-encryption true \
        --enabled-for-template-deployment true \
        --output none
    
    # Set access policy
    az keyvault set-policy \
        --name "$KEY_VAULT_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --object-id "$USER_OBJECT_ID" \
        --secret-permissions get set list delete \
        --output none
    
    # Store secrets
    az keyvault secret set \
        --vault-name "$KEY_VAULT_NAME" \
        --name "JWT-SECRET" \
        --value "$JWT_SECRET" \
        --output none
    
    az keyvault secret set \
        --vault-name "$KEY_VAULT_NAME" \
        --name "MONGODB-URI" \
        --value "$COSMOS_CONNECTION_STRING" \
        --output none
    
    print_success "Key Vault created: $KEY_VAULT_NAME"
    
    # Save Key Vault information
    echo "KEY_VAULT_NAME=$KEY_VAULT_NAME" >> "$CONFIG_FILE"
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
    echo "Resource Group: $RESOURCE_GROUP"
    echo "Location: $LOCATION"
    echo ""
    echo "Application URLs:"
    echo "  Container Instance: http://$CONTAINER_FQDN:3000"
    echo "  Health Check: http://$CONTAINER_FQDN:3000/health"
    if [ ! -z "$FRONT_DOOR_HOSTNAME" ]; then
        echo "  Front Door: https://$FRONT_DOOR_HOSTNAME"
    fi
    echo ""
    echo "Database:"
    echo "  Cosmos DB Account: $COSMOS_ACCOUNT_NAME"
    echo "  Database: envfly"
    echo "  Connection String: (stored in Key Vault)"
    echo ""
    echo "Container Registry:"
    echo "  ACR: $REGISTRY_LOGIN_SERVER"
    echo "  Image: $REGISTRY_LOGIN_SERVER/$PROJECT_NAME:latest"
    echo ""
    echo "Monitoring:"
    echo "  Application Insights: $APP_INSIGHTS_NAME"
    echo "  Key Vault: $KEY_VAULT_NAME"
    echo ""
    echo "Configuration saved to: $CONFIG_FILE"
    echo ""
    echo "To update the deployment, run:"
    echo "  ./scripts/update-azure.sh"
    echo ""
    echo "To destroy the deployment, run:"
    echo "  ./scripts/destroy-azure.sh"
}

# Main deployment function
deploy() {
    print_status "Starting Azure deployment for $PROJECT_NAME..."
    
    # Pre-flight checks
    check_azure_cli
    check_docker
    check_azure_login
    
    # Get user input
    get_user_input
    
    # Create resources
    create_resource_group
    create_container_registry
    build_and_push_image
    create_cosmos_db
    create_app_insights
    create_container_instance
    create_key_vault
    
    # Optional: Create Front Door for global distribution
    read -p "Create Azure Front Door for global distribution? (y/N): " create_fd
    if [[ $create_fd =~ ^[Yy]$ ]]; then
        create_front_door
    fi
    
    # Display results
    display_deployment_info
}

# Function to show help
show_help() {
    echo "EnvFly Backend Azure Deployment Script"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  -c, --config   Use existing configuration"
    echo ""
    echo "This script will:"
    echo "  1. Create Azure Container Registry"
    echo "  2. Build and push the Docker image"
    echo "  3. Create Cosmos DB MongoDB account"
    echo "  4. Create Application Insights"
    echo "  5. Create Container Instance"
    echo "  6. Create Key Vault for secrets"
    echo "  7. Optionally create Front Door"
    echo ""
    echo "Prerequisites:"
    echo "  - Azure CLI installed and configured"
    echo "  - Docker installed"
    echo "  - Azure subscription with appropriate permissions"
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