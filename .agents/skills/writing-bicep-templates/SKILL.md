---
name: writing-bicep-templates
description: Provides Bicep coding standards for Azure infrastructure in this repository. Use when writing or modifying Bicep files, configuring Container Apps, setting up RBAC, or working with Azure resources.
---

# Bicep Coding Standards

**Goal**: Create consistent, secure Azure infrastructure

## Naming Convention

Use `resourceToken` from `uniqueString()`:

```bicep
var token = toLower(uniqueString(subscription().id, environmentName, location))
name: '${abbrs.appContainerApps}web-${token}'  // ca-web-abc123
```

**Exception**: ACR requires alphanumeric only: `cr${resourceToken}`

## Parameters

Always add `@description()` and use `@allowed()` for constrained values:

```bicep
@description('Environment (dev, prod)')
param environmentName string

@description('Azure region')
@allowed(['eastus2', 'westus2'])
param location string = 'eastus2'
```

## Outputs

Expose key identifiers for `azd` and other modules:

```bicep
output containerAppName string = containerApp.name
output webEndpoint string = 'https://${containerApp.properties.configuration.ingress.fqdn}'
output identityPrincipalId string = containerApp.identity.principalId
```

## Managed Identity

Use a user-assigned MI for ACR pull and OBO (avoids circular dependencies). Create it in the infrastructure module so its `principalId` is available before the Container App:

```bicep
resource managedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2024-11-30' = {
  name: '${abbrs.managedIdentityUserAssignedIdentities}web-${resourceToken}'
  location: location
  properties: { isolationScope: 'Regional' }
}
output managedIdentityPrincipalId string = managedIdentity.properties.principalId
```

Attach to Container App with `identity: { type: 'UserAssigned', userAssignedIdentities: { '${miId}': {} } }`. Use MI for ACR pull via `registries: [{ server: acr.loginServer, identity: miId }]`.

## RBAC Assignments

Use `guid()` for names + specify `principalType`:

```bicep
resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(resource.id, principalId, roleId)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleId)
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}
```

## Container Apps

Key settings: System identity + scale-to-zero + HTTPS only:

```bicep
resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  identity: { type: 'UserAssigned', userAssignedIdentities: { '${userAssignedIdentityId}': {} } }
  properties: {
    configuration: {
      ingress: {
        external: true
        targetPort: 8080
        allowInsecure: false
      }
    }
    template: {
      scale: { minReplicas: 0, maxReplicas: 3 }
    }
  }
}
```

## ACR Pull Pattern

Use user-assigned MI for ACR pull (no admin credentials or secrets):

```bicep
registries: [{
  server: containerRegistry.properties.loginServer
  identity: userAssignedIdentityId  // MI with AcrPull role
}]
```

## Validation

```powershell
az bicep build --file main.bicep
az deployment group what-if --template-file main.bicep
```

---

## Project-Specific: Module Hierarchy

```text
main.bicep (subscription scope)
├─ Resource group
├─ main-infrastructure.bicep (ACR + Container Apps Env + Log Analytics + User-Assigned MI)
├─ entra-app.bicep (SPA app + conditional OBO backend app with FIC + admin consent)
├─ main-app.bicep (Container App with MI-based ACR pull)
└─ RBAC (Cognitive Services User role via postprovision CLI)
```

## Project-Specific: Container App Configuration

```bicep
resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${userAssignedIdentityId}': {} }
  }
  properties: {
    managedEnvironmentId: containerAppsEnvironmentId
    configuration: {
      ingress: {
        external: true
        targetPort: 8080
        allowInsecure: false
      }
      registries: [{
        server: containerRegistry.properties.loginServer
        identity: userAssignedIdentityId  // MI-based pull, no secrets
      }]
    }
    template: {
      containers: [{
        name: 'web'
        image: containerImage
        env: containerEnv  // Base env + conditional OBO env
        resources: { cpu: json('0.5'), memory: '1Gi' }
      }]
      scale: { minReplicas: 0, maxReplicas: 3 }
    }
  }
}

output fqdn string = containerApp.properties.configuration.ingress.fqdn
output identityPrincipalId string = containerApp.identity.principalId
```

## Related Skills

- **deploying-to-azure** - Deployment commands and hook workflow
- **writing-csharp-code** - Backend configuration for Container Apps
- **troubleshooting-authentication** - RBAC and managed identity debugging
