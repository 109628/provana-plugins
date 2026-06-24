---
name: azure-deployment
description: Use when provisioning an Azure stack end-to-end — RGs, ACR, AKS/Container Apps, Functions, Postgres Flex, VNet/NSG/private endpoints, DNS, Managed Identity, Key Vault, Monitor. Produces runnable Bicep + az CLI. Trigger on "deploy to azure", "provision infrastructure", "set up azure", "deploy my app".
---

# Azure Deployment — End-to-End Provisioning

Full Azure deployment lifecycle from blank subscription to production-ready infrastructure. Produces Bicep templates (preferred) and az CLI scripts. Every resource is wired together — no manual portal steps required after running the scripts.

**Announce at start:** "Running azure-deployment. Planning infrastructure."

## Deployment philosophy

- **Infrastructure as Code always**: no manual portal clicks. Every resource in Bicep or az CLI.
- **Managed Identity over connection strings**: never store credentials in app config. Use MI + Key Vault references.
- **Private endpoints for data services**: PostgreSQL, Storage, Key Vault — never exposed to public internet.
- **Least-privilege RBAC**: every resource gets the minimum role needed, no `Owner` or `Contributor` at subscription scope unless absolutely required.
- **Naming convention**: `[project]-[environment]-[resource-type]-[region-short]` e.g. `provana-prod-aks-eus2`

---

## Step 1: Deployment design questionnaire

Before writing any IaC:

```
1. Project name and environment? (dev / staging / prod)
2. Azure region? (eastus2 recommended for US — lower latency to Azure OpenAI)
3. What services are needed?
   [ ] Container Registry (ACR)
   [ ] AKS / Container Apps (choose: AKS for complex orchestration, CA for simpler)
   [ ] Azure Functions (language? Python / Node / C#)
   [ ] Storage Account (blob / table / queue / file)
   [ ] PostgreSQL Flexible Server
   [ ] Azure OpenAI / Cognitive Services
   [ ] Event Hub / Service Bus
   [ ] Azure AI Search (vector search)
   [ ] Key Vault
   [ ] Application Insights + Log Analytics
4. Network isolation required? (private endpoints for data services — recommended)
5. Custom domain / DNS? (apex domain or subdomain)
6. Expected scale? (informs SKU selection)
7. Existing Azure AD tenant? (for Managed Identity and RBAC)
```

---

## Step 2: Foundation — Resource Group, VNet, Log Analytics

```bash
# scripts/01-foundation.sh
#!/usr/bin/env bash
set -euo pipefail

PROJECT="${PROJECT_NAME:-provana}"
ENV="${ENVIRONMENT:-dev}"
REGION="${AZURE_REGION:-eastus2}"
RG="${PROJECT}-${ENV}-rg"

echo "=== Foundation: Resource Group + Networking ==="

# Resource group
az group create \
  --name "$RG" \
  --location "$REGION" \
  --tags "project=$PROJECT" "environment=$ENV" "managed-by=provana-superpowers"

echo "✅ Resource group: $RG"

# Log Analytics workspace (must exist before anything else — everything ships logs here)
LAW_NAME="${PROJECT}-${ENV}-law"
az monitor log-analytics workspace create \
  --resource-group "$RG" \
  --workspace-name "$LAW_NAME" \
  --location "$REGION" \
  --sku PerGB2018 \
  --retention-time 30

LAW_ID=$(az monitor log-analytics workspace show \
  --resource-group "$RG" \
  --workspace-name "$LAW_NAME" \
  --query id -o tsv)

echo "✅ Log Analytics: $LAW_NAME"
echo "   Workspace ID: $LAW_ID"

# Export for subsequent scripts
cat > ".env.azure.${ENV}" << EOF
RESOURCE_GROUP=$RG
REGION=$REGION
PROJECT=$PROJECT
ENV=$ENV
LAW_ID=$LAW_ID
LAW_NAME=$LAW_NAME
EOF
```

---

## Step 3: Networking — VNet, Subnets, NSGs

```bicep
// bicep/networking.bicep
param project string
param environment string
param location string = resourceGroup().location

var vnetName = '${project}-${environment}-vnet'
var addressPrefix = '10.0.0.0/16'

resource vnet 'Microsoft.Network/virtualNetworks@2023-05-01' = {
  name: vnetName
  location: location
  tags: { project: project, environment: environment }
  properties: {
    addressSpace: { addressPrefixes: [ addressPrefix ] }
    subnets: [
      // AKS / Container Apps — /22 gives 1022 usable IPs for pods
      {
        name: 'aks-subnet'
        properties: {
          addressPrefix: '10.0.0.0/22'
          // Delegate to AKS if using Azure CNI
        }
      }
      // Private endpoints — data services (Postgres, Storage, Key Vault)
      {
        name: 'private-endpoint-subnet'
        properties: {
          addressPrefix: '10.0.4.0/24'
          privateEndpointNetworkPolicies: 'Disabled'  // Required for private endpoints
        }
      }
      // Azure Functions (if using VNet integration)
      {
        name: 'functions-subnet'
        properties: {
          addressPrefix: '10.0.5.0/24'
          delegations: [
            {
              name: 'functions-delegation'
              properties: { serviceName: 'Microsoft.Web/serverFarms' }
            }
          ]
        }
      }
      // App Gateway / ingress (if public-facing)
      {
        name: 'appgw-subnet'
        properties: { addressPrefix: '10.0.6.0/24' }
      }
    ]
  }
}

// NSG: AKS subnet — allow intra-cluster, block direct internet to pods
resource aksNsg 'Microsoft.Network/networkSecurityGroups@2023-05-01' = {
  name: '${project}-${environment}-aks-nsg'
  location: location
  properties: {
    securityRules: [
      {
        name: 'AllowHTTPSInbound'
        properties: {
          priority: 100
          protocol: 'Tcp'
          access: 'Allow'
          direction: 'Inbound'
          sourceAddressPrefix: 'AzureFrontDoor.Backend'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '443'
        }
      }
      {
        name: 'DenyDirectInternetInbound'
        properties: {
          priority: 4000
          protocol: '*'
          access: 'Deny'
          direction: 'Inbound'
          sourceAddressPrefix: 'Internet'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '*'
        }
      }
    ]
  }
}

output vnetId string = vnet.id
output aksSubnetId string = vnet.properties.subnets[0].id
output privateEndpointSubnetId string = vnet.properties.subnets[1].id
output functionsSubnetId string = vnet.properties.subnets[2].id
```

```bash
# Deploy networking
az deployment group create \
  --resource-group "$RG" \
  --template-file bicep/networking.bicep \
  --parameters project="$PROJECT" environment="$ENV" \
  --name "networking-$(date +%Y%m%d%H%M)"
```

---

## Step 4: Container Registry (ACR)

```bash
# scripts/02-acr.sh
#!/usr/bin/env bash
source ".env.azure.${ENVIRONMENT:-dev}"
set -euo pipefail

ACR_NAME="${PROJECT}${ENV}acr"   # ACR names: alphanumeric only, 5-50 chars
ACR_SKU="Premium"                # Premium required for private endpoints + geo-replication

echo "=== Container Registry ==="

az acr create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$ACR_NAME" \
  --sku "$ACR_SKU" \
  --location "$REGION" \
  --admin-enabled false \           # Use Managed Identity, not admin credentials
  --public-network-enabled false    # Private endpoint only

# Private endpoint for ACR
ACR_ID=$(az acr show --name "$ACR_NAME" --resource-group "$RESOURCE_GROUP" --query id -o tsv)
PE_SUBNET_ID=$(az network vnet subnet show \
  --resource-group "$RESOURCE_GROUP" \
  --vnet-name "${PROJECT}-${ENV}-vnet" \
  --name "private-endpoint-subnet" \
  --query id -o tsv)

az network private-endpoint create \
  --name "${ACR_NAME}-pe" \
  --resource-group "$RESOURCE_GROUP" \
  --vnet-name "${PROJECT}-${ENV}-vnet" \
  --subnet "private-endpoint-subnet" \
  --private-connection-resource-id "$ACR_ID" \
  --group-id registry \
  --connection-name "${ACR_NAME}-connection"

# Private DNS zone for ACR
az network private-dns zone create \
  --resource-group "$RESOURCE_GROUP" \
  --name "privatelink.azurecr.io"

az network private-dns link vnet create \
  --resource-group "$RESOURCE_GROUP" \
  --zone-name "privatelink.azurecr.io" \
  --name "${ACR_NAME}-dns-link" \
  --virtual-network "${PROJECT}-${ENV}-vnet" \
  --registration-enabled false

# DNS zone group (auto-registers private endpoint IPs)
az network private-endpoint dns-zone-group create \
  --resource-group "$RESOURCE_GROUP" \
  --endpoint-name "${ACR_NAME}-pe" \
  --name "acr-dns-zone-group" \
  --private-dns-zone "privatelink.azurecr.io" \
  --zone-name "azurecr"

echo "✅ ACR: $ACR_NAME (private endpoint)"
echo "   Login: az acr login --name $ACR_NAME"
echo "   Push:  docker tag myimage ${ACR_NAME}.azurecr.io/myimage:latest"
echo "          docker push ${ACR_NAME}.azurecr.io/myimage:latest"

# Append to env file
echo "ACR_NAME=$ACR_NAME" >> ".env.azure.${ENV}"
echo "ACR_LOGIN_SERVER=${ACR_NAME}.azurecr.io" >> ".env.azure.${ENV}"
```

### Build and push container

```bash
# scripts/build-push.sh
#!/usr/bin/env bash
source ".env.azure.${ENVIRONMENT:-dev}"
set -euo pipefail

IMAGE_NAME="${1:-myapp}"
IMAGE_TAG="${2:-$(git rev-parse --short HEAD)}"
FULL_IMAGE="${ACR_LOGIN_SERVER}/${IMAGE_NAME}:${IMAGE_TAG}"

az acr login --name "$ACR_NAME"

docker build -t "$FULL_IMAGE" \
  --build-arg BUILD_DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --build-arg GIT_COMMIT="$IMAGE_TAG" \
  --label "org.opencontainers.image.revision=$IMAGE_TAG" \
  .

docker push "$FULL_IMAGE"

# Also tag as latest
docker tag "$FULL_IMAGE" "${ACR_LOGIN_SERVER}/${IMAGE_NAME}:latest"
docker push "${ACR_LOGIN_SERVER}/${IMAGE_NAME}:latest"

echo "✅ Pushed: $FULL_IMAGE"
echo "   Also tagged: ${ACR_LOGIN_SERVER}/${IMAGE_NAME}:latest"
```

---

## Step 5: Azure Container Apps (recommended for most AI services)

**Use Container Apps when**: stateless services, event-driven scaling, simple HTTP/queue-triggered workloads. Cheaper and simpler than AKS for most AI pipeline services.

**Use AKS when**: complex orchestration, custom networking (Istio, Cilium), GPU workloads, multiple clusters, fine-grained pod scheduling.

```bicep
// bicep/container-apps.bicep
param project string
param environment string
param location string = resourceGroup().location
param acrLoginServer string
param imageTag string
param subnetId string
param lawId string

var caeName = '${project}-${environment}-cae'  // Container Apps Environment
var caName  = '${project}-${environment}-ca'   // Container App

// Container Apps Environment (the cluster)
resource cae 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: caeName
  location: location
  tags: { project: project, environment: environment }
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: reference(lawId, '2022-10-01').customerId
        sharedKey: listKeys(lawId, '2022-10-01').primarySharedKey
      }
    }
    vnetConfiguration: {
      infrastructureSubnetId: subnetId
      internal: true   // No public IP on the environment — use App Gateway or Front Door
    }
    workloadProfiles: [
      {
        name: 'Consumption'
        workloadProfileType: 'Consumption'  // Scale to zero — cheapest
      }
    ]
  }
}

// Managed Identity for the app
resource appIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${project}-${environment}-app-mi'
  location: location
}

// The Container App
resource ca 'Microsoft.App/containerApps@2023-05-01' = {
  name: caName
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${appIdentity.id}': {} }
  }
  properties: {
    managedEnvironmentId: cae.id
    configuration: {
      ingress: {
        external: false          // Internal only — fronted by App Gateway
        targetPort: 8000
        transport: 'http'
        corsPolicy: {
          allowedOrigins: [ 'https://${project}.provana.com' ]
        }
      }
      registries: [
        {
          server: acrLoginServer
          identity: appIdentity.id  // Pull from ACR via Managed Identity
        }
      ]
      secrets: []  // Secrets injected via Key Vault references below
    }
    template: {
      containers: [
        {
          name: caName
          image: '${acrLoginServer}/${project}-api:${imageTag}'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            { name: 'ENVIRONMENT', value: environment }
            { name: 'AZURE_CLIENT_ID', value: appIdentity.properties.clientId }
            // Key Vault references — never hardcode secrets
            { name: 'DB_CONNECTION_STRING', secretRef: 'db-connection-string' }
            { name: 'AZURE_OPENAI_KEY',     secretRef: 'openai-key' }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: { path: '/health', port: 8000 }
              initialDelaySeconds: 10
              periodSeconds: 30
            }
            {
              type: 'Readiness'
              httpGet: { path: '/ready', port: 8000 }
              initialDelaySeconds: 5
              periodSeconds: 10
            }
          ]
        }
      ]
      scale: {
        minReplicas: environment == 'prod' ? 2 : 0  // Scale to zero in non-prod
        maxReplicas: 10
        rules: [
          {
            name: 'http-scaling'
            http: { metadata: { concurrentRequests: '50' } }
          }
        ]
      }
    }
  }
}

output containerAppFqdn string = ca.properties.configuration.ingress.fqdn
output managedIdentityId string = appIdentity.id
output managedIdentityClientId string = appIdentity.properties.clientId
```

---

## Step 6: Azure Function Apps

```bash
# scripts/04-function-app.sh
#!/usr/bin/env bash
source ".env.azure.${ENVIRONMENT:-dev}"
set -euo pipefail

FUNC_NAME="${PROJECT}-${ENV}-func"
STORAGE_NAME="${PROJECT}${ENV}funcstor"   # Storage for Function App state
PLAN_NAME="${PROJECT}-${ENV}-func-plan"

echo "=== Function App ==="

# Storage account for Function App (separate from application storage)
az storage account create \
  --name "$STORAGE_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$REGION" \
  --sku Standard_LRS \
  --allow-blob-public-access false \
  --https-only true \
  --min-tls-version TLS1_2

# App Service Plan (use Consumption for event-driven, Premium for VNet + warm start)
az functionapp plan create \
  --name "$PLAN_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$REGION" \
  --sku EP1 \           # ElasticPremium P1 — required for VNet integration
  --is-linux true

# Function App
az functionapp create \
  --name "$FUNC_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --plan "$PLAN_NAME" \
  --storage-account "$STORAGE_NAME" \
  --runtime python \
  --runtime-version 3.11 \
  --functions-version 4 \
  --assign-identity '[system]' \    # System-assigned Managed Identity
  --https-only true

# VNet integration (outbound — for accessing private endpoints)
FUNC_SUBNET_ID=$(az network vnet subnet show \
  --resource-group "$RESOURCE_GROUP" \
  --vnet-name "${PROJECT}-${ENV}-vnet" \
  --name "functions-subnet" \
  --query id -o tsv)

az functionapp vnet-integration add \
  --name "$FUNC_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --vnet "${PROJECT}-${ENV}-vnet" \
  --subnet "functions-subnet"

# Always-on equivalent for Premium (keep one warm instance)
az functionapp config set \
  --name "$FUNC_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --always-on true

FUNC_MI_PRINCIPAL=$(az functionapp identity show \
  --name "$FUNC_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query principalId -o tsv)

echo "✅ Function App: $FUNC_NAME"
echo "   Managed Identity principal: $FUNC_MI_PRINCIPAL"
echo "   Deploy: func azure functionapp publish $FUNC_NAME"

echo "FUNC_NAME=$FUNC_NAME" >> ".env.azure.${ENV}"
echo "FUNC_MI_PRINCIPAL=$FUNC_MI_PRINCIPAL" >> ".env.azure.${ENV}"
```

---

## Step 7: Storage Account (application data)

```bash
# scripts/05-storage.sh
#!/usr/bin/env bash
source ".env.azure.${ENVIRONMENT:-dev}"
set -euo pipefail

STORAGE_NAME="${PROJECT}${ENV}stor"

echo "=== Storage Account ==="

az storage account create \
  --name "$STORAGE_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$REGION" \
  --sku Standard_ZRS \              # Zone-redundant for prod; use LRS for dev
  --kind StorageV2 \
  --access-tier Hot \
  --allow-blob-public-access false \ # Never public — always private endpoint
  --https-only true \
  --min-tls-version TLS1_2 \
  --public-network-access Disabled   # Force private endpoint only

STORAGE_ID=$(az storage account show \
  --name "$STORAGE_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query id -o tsv)

# Private endpoint for blob
az network private-endpoint create \
  --name "${STORAGE_NAME}-blob-pe" \
  --resource-group "$RESOURCE_GROUP" \
  --vnet-name "${PROJECT}-${ENV}-vnet" \
  --subnet "private-endpoint-subnet" \
  --private-connection-resource-id "$STORAGE_ID" \
  --group-id blob \
  --connection-name "${STORAGE_NAME}-blob-connection"

# Private DNS for storage blob
az network private-dns zone create \
  --resource-group "$RESOURCE_GROUP" \
  --name "privatelink.blob.core.windows.net" 2>/dev/null || true

az network private-dns link vnet create \
  --resource-group "$RESOURCE_GROUP" \
  --zone-name "privatelink.blob.core.windows.net" \
  --name "${STORAGE_NAME}-blob-dns-link" \
  --virtual-network "${PROJECT}-${ENV}-vnet" \
  --registration-enabled false 2>/dev/null || true

az network private-endpoint dns-zone-group create \
  --resource-group "$RESOURCE_GROUP" \
  --endpoint-name "${STORAGE_NAME}-blob-pe" \
  --name "blob-dns-zone-group" \
  --private-dns-zone "privatelink.blob.core.windows.net" \
  --zone-name "blob"

# Create application containers
az storage container create \
  --name "documents" \
  --account-name "$STORAGE_NAME" \
  --auth-mode login

az storage container create \
  --name "processed" \
  --account-name "$STORAGE_NAME" \
  --auth-mode login

az storage container create \
  --name "exports" \
  --account-name "$STORAGE_NAME" \
  --auth-mode login

echo "✅ Storage: $STORAGE_NAME (private endpoint, blob)"
echo "STORAGE_NAME=$STORAGE_NAME" >> ".env.azure.${ENV}"
echo "STORAGE_ID=$STORAGE_ID" >> ".env.azure.${ENV}"
```

---

## Step 8: PostgreSQL Flexible Server

```bash
# scripts/06-postgres.sh
#!/usr/bin/env bash
source ".env.azure.${ENVIRONMENT:-dev}"
set -euo pipefail

PG_NAME="${PROJECT}-${ENV}-pg"
PG_ADMIN="pgadmin"
PG_DB="${PROJECT}_${ENV}"
PG_VERSION="16"

# SKU selection by environment
case "$ENV" in
  prod)    PG_SKU="Standard_D4ds_v5"; PG_STORAGE=128 ;;  # 4 vCPU, 16GB, 128GB storage
  staging) PG_SKU="Standard_D2ds_v5"; PG_STORAGE=64  ;;  # 2 vCPU, 8GB
  dev)     PG_SKU="Standard_B2ms";    PG_STORAGE=32   ;;  # Burstable, cheapest
esac

echo "=== PostgreSQL Flexible Server ==="

# Generate a strong admin password and store in Key Vault (created in step 9)
PG_PASSWORD=$(openssl rand -base64 32)

# Create with private access only (no public endpoint)
az postgres flexible-server create \
  --name "$PG_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$REGION" \
  --admin-user "$PG_ADMIN" \
  --admin-password "$PG_PASSWORD" \
  --sku-name "$PG_SKU" \
  --tier "GeneralPurpose" \
  --storage-size "$PG_STORAGE" \
  --version "$PG_VERSION" \
  --high-availability "ZoneRedundant" \   # Prod: ZoneRedundant; dev: Disabled
  --private-dns-zone "${PROJECT}-${ENV}-pg.private.postgres.database.azure.com" \
  --vnet "${PROJECT}-${ENV}-vnet" \
  --subnet "private-endpoint-subnet" \
  --backup-retention 7 \
  --geo-redundant-backup Disabled \       # Enable for prod
  --public-access Disabled

# Create application database
az postgres flexible-server db create \
  --resource-group "$RESOURCE_GROUP" \
  --server-name "$PG_NAME" \
  --database-name "$PG_DB"

# Enable extensions needed for vector search (pgvector)
az postgres flexible-server parameter set \
  --resource-group "$RESOURCE_GROUP" \
  --server-name "$PG_NAME" \
  --name "azure.extensions" \
  --value "VECTOR,UUID-OSSP,PG_TRGM"

PG_FQDN="${PG_NAME}.postgres.database.azure.com"
PG_CONN="postgresql://${PG_ADMIN}:${PG_PASSWORD}@${PG_FQDN}/${PG_DB}?sslmode=require"

echo "✅ PostgreSQL: $PG_NAME (private, zone-redundant)"
echo "   FQDN: $PG_FQDN"
echo "   Extensions enabled: vector, uuid-ossp, pg_trgm"
echo "   ⚠️  Password stored in Key Vault (next step)"

echo "PG_NAME=$PG_NAME" >> ".env.azure.${ENV}"
echo "PG_FQDN=$PG_FQDN" >> ".env.azure.${ENV}"
echo "PG_PASSWORD_TEMP=$PG_PASSWORD" >> ".env.azure.${ENV}"  # Will be rotated to KV
```

---

## Step 9: Key Vault — Secrets Management

```bash
# scripts/07-keyvault.sh
#!/usr/bin/env bash
source ".env.azure.${ENVIRONMENT:-dev}"
set -euo pipefail

KV_NAME="${PROJECT}-${ENV}-kv"

echo "=== Key Vault ==="

az keyvault create \
  --name "$KV_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$REGION" \
  --sku standard \
  --enable-rbac-authorization true \    # RBAC model (not access policies)
  --public-network-access Disabled \    # Private endpoint only
  --enable-soft-delete true \
  --retention-days 90

KV_ID=$(az keyvault show --name "$KV_NAME" --resource-group "$RESOURCE_GROUP" --query id -o tsv)

# Private endpoint for Key Vault
az network private-endpoint create \
  --name "${KV_NAME}-pe" \
  --resource-group "$RESOURCE_GROUP" \
  --vnet-name "${PROJECT}-${ENV}-vnet" \
  --subnet "private-endpoint-subnet" \
  --private-connection-resource-id "$KV_ID" \
  --group-id vault \
  --connection-name "${KV_NAME}-connection"

# Private DNS zone
az network private-dns zone create \
  --resource-group "$RESOURCE_GROUP" \
  --name "privatelink.vaultcore.azure.net" 2>/dev/null || true

az network private-dns link vnet create \
  --resource-group "$RESOURCE_GROUP" \
  --zone-name "privatelink.vaultcore.azure.net" \
  --name "${KV_NAME}-dns-link" \
  --virtual-network "${PROJECT}-${ENV}-vnet" \
  --registration-enabled false 2>/dev/null || true

az network private-endpoint dns-zone-group create \
  --resource-group "$RESOURCE_GROUP" \
  --endpoint-name "${KV_NAME}-pe" \
  --name "kv-dns-zone-group" \
  --private-dns-zone "privatelink.vaultcore.azure.net" \
  --zone-name "vault"

# Store application secrets
az keyvault secret set --vault-name "$KV_NAME" --name "db-connection-string" \
  --value "postgresql://${PG_ADMIN}:${PG_PASSWORD_TEMP}@${PG_FQDN}/${PROJECT}_${ENV}?sslmode=require"

az keyvault secret set --vault-name "$KV_NAME" --name "openai-api-key" \
  --value "${AZURE_OPENAI_KEY:-REPLACE_ME}"

az keyvault secret set --vault-name "$KV_NAME" --name "azure-speech-key" \
  --value "${AZURE_SPEECH_KEY:-REPLACE_ME}"

# Clear temp password from env file
sed -i '/PG_PASSWORD_TEMP/d' ".env.azure.${ENV}"

echo "✅ Key Vault: $KV_NAME (private endpoint, RBAC)"
echo "   Secrets stored: db-connection-string, openai-api-key, azure-speech-key"
echo "KV_NAME=$KV_NAME" >> ".env.azure.${ENV}"
echo "KV_ID=$KV_ID" >> ".env.azure.${ENV}"
```

---

## Step 10: Managed Identity + RBAC Wiring

```bash
# scripts/08-rbac.sh
#!/usr/bin/env bash
# Wire Managed Identities to resources via RBAC — no secrets in config
source ".env.azure.${ENVIRONMENT:-dev}"
set -euo pipefail

echo "=== RBAC Wiring ==="

# Get resource IDs
STORAGE_ID=$(az storage account show --name "$STORAGE_NAME" --resource-group "$RESOURCE_GROUP" --query id -o tsv)
KV_ID=$(az keyvault show --name "$KV_NAME" --resource-group "$RESOURCE_GROUP" --query id -o tsv)
ACR_ID=$(az acr show --name "$ACR_NAME" --resource-group "$RESOURCE_GROUP" --query id -o tsv)

# Container App Managed Identity → ACR (pull images)
az role assignment create \
  --assignee "$CA_MANAGED_IDENTITY_PRINCIPAL" \
  --role "AcrPull" \
  --scope "$ACR_ID"

# Container App → Storage Blob (read/write documents)
az role assignment create \
  --assignee "$CA_MANAGED_IDENTITY_PRINCIPAL" \
  --role "Storage Blob Data Contributor" \
  --scope "$STORAGE_ID"

# Container App → Key Vault (read secrets)
az role assignment create \
  --assignee "$CA_MANAGED_IDENTITY_PRINCIPAL" \
  --role "Key Vault Secrets User" \
  --scope "$KV_ID"

# Function App → Storage (its own state storage)
az role assignment create \
  --assignee "$FUNC_MI_PRINCIPAL" \
  --role "Storage Blob Data Contributor" \
  --scope "$STORAGE_ID"

# Function App → Key Vault
az role assignment create \
  --assignee "$FUNC_MI_PRINCIPAL" \
  --role "Key Vault Secrets User" \
  --scope "$KV_ID"

# AKS (if used) → ACR
if [ -n "${AKS_KUBELET_MI:-}" ]; then
  az role assignment create \
    --assignee "$AKS_KUBELET_MI" \
    --role "AcrPull" \
    --scope "$ACR_ID"
fi

echo "✅ RBAC assignments complete"
echo "   All services use Managed Identity — zero stored credentials"
```

---

## Step 11: Public IP, DNS, and App Gateway

```bash
# scripts/09-ingress.sh
#!/usr/bin/env bash
# Public IP + App Gateway for HTTPS ingress. Skip if using Azure Front Door.
source ".env.azure.${ENVIRONMENT:-dev}"
set -euo pipefail

AGW_NAME="${PROJECT}-${ENV}-agw"
PIP_NAME="${PROJECT}-${ENV}-pip"
CUSTOM_DOMAIN="${CUSTOM_DOMAIN:-${PROJECT}-${ENV}.provana.com}"

echo "=== Public IP + App Gateway ==="

# Static public IP (required for App Gateway)
az network public-ip create \
  --name "$PIP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$REGION" \
  --sku Standard \
  --allocation-method Static \
  --dns-name "${PROJECT}-${ENV}" \   # Creates [name].[region].cloudapp.azure.com
  --zone 1 2 3                       # Zone-redundant

PUBLIC_IP=$(az network public-ip show \
  --name "$PIP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query ipAddress -o tsv)

AZURE_FQDN=$(az network public-ip show \
  --name "$PIP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query dnsSettings.fqdn -o tsv)

echo "✅ Public IP: $PUBLIC_IP"
echo "   Azure FQDN: $AZURE_FQDN"

# App Gateway with WAF (Web Application Firewall)
az network application-gateway create \
  --name "$AGW_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$REGION" \
  --vnet-name "${PROJECT}-${ENV}-vnet" \
  --subnet "appgw-subnet" \
  --public-ip-address "$PIP_NAME" \
  --sku WAF_v2 \
  --capacity 2 \                     # Min 2 for zone redundancy
  --http-settings-port 8000 \
  --http-settings-protocol Http \    # Backend is HTTP (TLS terminates at AGW)
  --frontend-port 443 \
  --priority 100

echo "✅ App Gateway: $AGW_NAME (WAF_v2)"
echo "   Route traffic to Container App: $CONTAINER_APP_FQDN"

echo "PUBLIC_IP=$PUBLIC_IP" >> ".env.azure.${ENV}"
echo "AZURE_FQDN=$AZURE_FQDN" >> ".env.azure.${ENV}"
```

### DNS Registration

```bash
# scripts/10-dns.sh
#!/usr/bin/env bash
# Register DNS — either Azure DNS or external registrar
source ".env.azure.${ENVIRONMENT:-dev}"
set -euo pipefail

DNS_ZONE="${DNS_ZONE:-provana.com}"
SUBDOMAIN="${SUBDOMAIN:-${PROJECT}-${ENV}}"
FULL_DOMAIN="${SUBDOMAIN}.${DNS_ZONE}"

echo "=== DNS Registration ==="

# Option A: Azure DNS zone (if DNS is hosted in Azure)
if az network dns zone show --name "$DNS_ZONE" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
  # A record pointing to App Gateway public IP
  az network dns record-set a add-record \
    --resource-group "$RESOURCE_GROUP" \
    --zone-name "$DNS_ZONE" \
    --record-set-name "$SUBDOMAIN" \
    --ipv4-address "$PUBLIC_IP" \
    --ttl 300

  echo "✅ DNS A record: $FULL_DOMAIN → $PUBLIC_IP (TTL 300s)"
  echo "   Verify: nslookup $FULL_DOMAIN"

else
  # Option B: External DNS — print instructions for manual registration
  echo "⚠️  DNS zone '$DNS_ZONE' not found in Azure."
  echo "   Manual DNS registration required at your registrar:"
  echo ""
  echo "   Type:  A"
  echo "   Name:  $SUBDOMAIN"
  echo "   Value: $PUBLIC_IP"
  echo "   TTL:   300"
  echo ""
  echo "   Or CNAME to Azure FQDN:"
  echo "   Type:  CNAME"
  echo "   Name:  $SUBDOMAIN"
  echo "   Value: $AZURE_FQDN"
fi

# TLS certificate via Azure-managed (App Gateway + Key Vault)
echo ""
echo "Next step: configure TLS certificate"
echo "  Option A (managed): az network application-gateway ssl-cert create (with Key Vault ref)"
echo "  Option B (Let's Encrypt): use cert-manager if on AKS"
```

---

## Step 12: AKS (when needed over Container Apps)

```bash
# scripts/aks.sh — use only when Container Apps is insufficient
#!/usr/bin/env bash
source ".env.azure.${ENVIRONMENT:-dev}"
set -euo pipefail

AKS_NAME="${PROJECT}-${ENV}-aks"
AKS_NODE_SKU="${AKS_NODE_SKU:-Standard_D4ds_v5}"  # 4 vCPU, 16GB
AKS_NODE_COUNT="${AKS_NODE_COUNT:-3}"

echo "=== AKS Cluster ==="

az aks create \
  --name "$AKS_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$REGION" \
  --node-count "$AKS_NODE_COUNT" \
  --node-vm-size "$AKS_NODE_SKU" \
  --network-plugin azure \           # Azure CNI — required for private endpoints
  --vnet-subnet-id "$(az network vnet subnet show \
    --resource-group $RESOURCE_GROUP \
    --vnet-name ${PROJECT}-${ENV}-vnet \
    --name aks-subnet --query id -o tsv)" \
  --enable-managed-identity \
  --attach-acr "$ACR_NAME" \         # Grants AcrPull automatically
  --enable-oidc-issuer \             # Required for workload identity
  --enable-workload-identity \       # Workload Identity (preferred over pod MI)
  --enable-cluster-autoscaler \
  --min-count 2 \
  --max-count 10 \
  --generate-ssh-keys \
  --tier standard \                  # Paid tier for SLA on control plane
  --os-sku AzureLinux \
  --auto-upgrade-channel patch \
  --workspace-resource-id "$LAW_ID" \ # Send logs to Log Analytics
  --enable-azure-monitor-metrics

# Get credentials
az aks get-credentials \
  --name "$AKS_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --overwrite-existing

echo "✅ AKS: $AKS_NAME ($AKS_NODE_COUNT × $AKS_NODE_SKU)"
echo "   kubectl get nodes"
```

---

## Step 13: Monitoring and Alerts

```bash
# scripts/11-monitoring.sh
#!/usr/bin/env bash
source ".env.azure.${ENVIRONMENT:-dev}"
set -euo pipefail

echo "=== Application Insights + Alerts ==="

# Application Insights (linked to Log Analytics)
APPINSIGHTS_NAME="${PROJECT}-${ENV}-ai"
az monitor app-insights component create \
  --app "$APPINSIGHTS_NAME" \
  --location "$REGION" \
  --resource-group "$RESOURCE_GROUP" \
  --workspace "$LAW_ID" \
  --kind web

APPINSIGHTS_KEY=$(az monitor app-insights component show \
  --app "$APPINSIGHTS_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query instrumentationKey -o tsv)

APPINSIGHTS_CONN=$(az monitor app-insights component show \
  --app "$APPINSIGHTS_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query connectionString -o tsv)

# Store in Key Vault
az keyvault secret set --vault-name "$KV_NAME" \
  --name "appinsights-connection-string" --value "$APPINSIGHTS_CONN"

# Alert: high error rate
az monitor metrics alert create \
  --name "${PROJECT}-${ENV}-high-error-rate" \
  --resource-group "$RESOURCE_GROUP" \
  --scopes "$(az monitor app-insights component show --app $APPINSIGHTS_NAME --resource-group $RESOURCE_GROUP --query id -o tsv)" \
  --condition "avg requests/failed > 10" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --severity 1 \
  --description "High error rate in $PROJECT $ENV"

# Alert: PostgreSQL high CPU
az monitor metrics alert create \
  --name "${PROJECT}-${ENV}-pg-high-cpu" \
  --resource-group "$RESOURCE_GROUP" \
  --scopes "$(az postgres flexible-server show --name $PG_NAME --resource-group $RESOURCE_GROUP --query id -o tsv)" \
  --condition "avg cpu_percent > 80" \
  --window-size 15m \
  --evaluation-frequency 5m \
  --severity 2

echo "✅ Monitoring: $APPINSIGHTS_NAME"
echo "   Connection string stored in Key Vault"
echo "APPINSIGHTS_NAME=$APPINSIGHTS_NAME" >> ".env.azure.${ENV}"
```

---

## One-shot deployment script

```bash
# scripts/deploy-all.sh
#!/usr/bin/env bash
# Full stack deployment — runs all steps in order
set -euo pipefail

export PROJECT_NAME="${1:-provana}"
export ENVIRONMENT="${2:-dev}"
export AZURE_REGION="${3:-eastus2}"

echo "╔══════════════════════════════════════════════╗"
echo "║  Provana Azure Deployment — Full Stack       ║"
echo "║  Project: $PROJECT_NAME  Env: $ENVIRONMENT  ║"
echo "╚══════════════════════════════════════════════╝"

bash scripts/01-foundation.sh
bash scripts/02-acr.sh
bash scripts/03-networking-deploy.sh   # deploys bicep/networking.bicep
bash scripts/05-storage.sh
bash scripts/06-postgres.sh
bash scripts/07-keyvault.sh
bash scripts/08-rbac.sh
bash scripts/04-function-app.sh
bash scripts/09-ingress.sh
bash scripts/10-dns.sh
bash scripts/11-monitoring.sh

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  Deployment Complete                         ║"
echo "╚══════════════════════════════════════════════╝"
cat ".env.azure.${ENVIRONMENT}"
echo ""
echo "Next steps:"
echo "  1. Build and push container: bash scripts/build-push.sh"
echo "  2. Deploy Container App: az deployment group create --template-file bicep/container-apps.bicep"
echo "  3. Configure TLS certificate"
echo "  4. Update DNS if using external registrar (see PUBLIC_IP above)"
echo "  5. Run smoke tests: pytest tests/smoke/ -v"
```

---

## Deployment checklist

See `references/deployment-checklist.md` for the pre-go-live verification list.

All scripts are in `skills/azure-deployment/scripts/`. All Bicep templates in `skills/azure-deployment/bicep/`.
