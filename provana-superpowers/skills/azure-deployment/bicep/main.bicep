// main.bicep — Full stack deployment orchestrator
// Deploy: az deployment group create --resource-group [rg] --template-file bicep/main.bicep --parameters @bicep/main.parameters.json

@description('Project name — used as prefix for all resources')
param project string

@description('Environment: dev | staging | prod')
@allowed(['dev', 'staging', 'prod'])
param environment string

@description('Azure region')
param location string = resourceGroup().location

@description('Container image tag to deploy')
param imageTag string = 'latest'

@description('Custom domain (leave empty to use Azure FQDN)')
param customDomain string = ''

@description('Admin email for alerts')
param alertEmail string

// ── Naming ──────────────────────────────────────────────────────────────────
var prefix = '${project}-${environment}'
var acrName = '${project}${environment}acr'
var storageName = '${project}${environment}stor'
var kvName = '${prefix}-kv'
var lawName = '${prefix}-law'
var aiName = '${prefix}-ai'
var pgName = '${prefix}-pg'
var caeName = '${prefix}-cae'
var caName = '${prefix}-ca'
var vnetName = '${prefix}-vnet'
var agwName = '${prefix}-agw'
var pipName = '${prefix}-pip'

// ── Log Analytics ──────────────────────────────────────────────────────────
resource law 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: lawName
  location: location
  tags: { project: project, environment: environment }
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: environment == 'prod' ? 90 : 30
  }
}

// ── Application Insights ──────────────────────────────────────────────────
resource ai 'Microsoft.Insights/components@2020-02-02' = {
  name: aiName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: law.id
  }
}

// ── VNet ──────────────────────────────────────────────────────────────────
resource vnet 'Microsoft.Network/virtualNetworks@2023-05-01' = {
  name: vnetName
  location: location
  properties: {
    addressSpace: { addressPrefixes: [ '10.0.0.0/16' ] }
    subnets: [
      { name: 'aks-subnet',              properties: { addressPrefix: '10.0.0.0/22' } }
      { name: 'private-endpoint-subnet', properties: { addressPrefix: '10.0.4.0/24', privateEndpointNetworkPolicies: 'Disabled' } }
      { name: 'functions-subnet',        properties: { addressPrefix: '10.0.5.0/24', delegations: [{ name: 'func-delegation', properties: { serviceName: 'Microsoft.Web/serverFarms' } }] } }
      { name: 'appgw-subnet',            properties: { addressPrefix: '10.0.6.0/24' } }
      { name: 'container-apps-subnet',   properties: { addressPrefix: '10.0.8.0/21' } }
    ]
  }
}

var peSubnetId = '${vnet.id}/subnets/private-endpoint-subnet'
var caSubnetId = '${vnet.id}/subnets/container-apps-subnet'

// ── Managed Identity for applications ─────────────────────────────────────
resource appIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${prefix}-app-mi'
  location: location
}

// ── Container Registry ─────────────────────────────────────────────────────
resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  sku: { name: environment == 'prod' ? 'Premium' : 'Basic' }
  properties: {
    adminUserEnabled: false
    publicNetworkAccess: environment == 'prod' ? 'Disabled' : 'Enabled'
  }
}

// AcrPull for app identity
resource acrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: acr
  name: guid(acr.id, appIdentity.id, 'AcrPull')
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
    principalId: appIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// ── Storage Account ────────────────────────────────────────────────────────
resource storage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageName
  location: location
  sku: { name: environment == 'prod' ? 'Standard_ZRS' : 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    allowBlobPublicAccess: false
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    publicNetworkAccess: 'Disabled'
  }
}

// Storage Blob Contributor for app identity
resource storageBlobContrib 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: storage
  name: guid(storage.id, appIdentity.id, 'StorageBlobDataContributor')
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')
    principalId: appIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// ── Key Vault ──────────────────────────────────────────────────────────────
resource kv 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: kvName
  location: location
  properties: {
    sku: { family: 'A', name: 'standard' }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    publicNetworkAccess: 'Disabled'
  }
}

// KV Secrets User for app identity
resource kvSecretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: kv
  name: guid(kv.id, appIdentity.id, 'KeyVaultSecretsUser')
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
    principalId: appIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// ── Container Apps Environment ─────────────────────────────────────────────
resource cae 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: caeName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: law.properties.customerId
        sharedKey: law.listKeys().primarySharedKey
      }
    }
    vnetConfiguration: {
      infrastructureSubnetId: caSubnetId
      internal: true
    }
  }
}

// ── Container App ──────────────────────────────────────────────────────────
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
        external: false
        targetPort: 8000
        transport: 'http'
      }
      registries: [{ server: acr.properties.loginServer, identity: appIdentity.id }]
    }
    template: {
      containers: [
        {
          name: caName
          image: '${acr.properties.loginServer}/${project}-api:${imageTag}'
          resources: { cpu: json('0.5'), memory: '1Gi' }
          env: [
            { name: 'ENVIRONMENT', value: environment }
            { name: 'AZURE_CLIENT_ID', value: appIdentity.properties.clientId }
            { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: ai.properties.ConnectionString }
          ]
        }
      ]
      scale: {
        minReplicas: environment == 'prod' ? 2 : 0
        maxReplicas: 10
      }
    }
  }
}

// ── Public IP ──────────────────────────────────────────────────────────────
resource pip 'Microsoft.Network/publicIPAddresses@2023-05-01' = {
  name: pipName
  location: location
  sku: { name: 'Standard' }
  zones: [ '1', '2', '3' ]
  properties: {
    publicIPAllocationMethod: 'Static'
    dnsSettings: { domainNameLabel: '${project}-${environment}' }
  }
}

// ── Outputs ────────────────────────────────────────────────────────────────
output publicIpAddress string = pip.properties.ipAddress
output publicFqdn string = pip.properties.dnsSettings.fqdn
output acrLoginServer string = acr.properties.loginServer
output containerAppFqdn string = ca.properties.configuration.ingress.fqdn
output keyVaultUri string = kv.properties.vaultUri
output storageAccountName string = storage.name
output managedIdentityClientId string = appIdentity.properties.clientId
output appInsightsConnectionString string = ai.properties.ConnectionString
output logAnalyticsWorkspaceId string = law.id
