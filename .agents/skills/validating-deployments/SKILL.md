---
name: validating-deployments
description: >
  End-of-session validation for MI and OBO deployment paths.
  Use after code changes to verify deploy → test → teardown works end-to-end.
---

# Validating Deployments

Run this at the end of any session that changes backend, frontend, infra, or auth code.

## Prerequisites

- All unit tests pass (`dotnet test` + `npm test`)
- Frontend builds (`npm run build`)
- Bicep validates (`az bicep build --file infra/main.bicep`)
- Playwright installed (`npx playwright install chromium`)

## Security Checks

Run before every deployment:

```powershell
# Backend: check for vulnerable NuGet packages
cd backend && dotnet list package --vulnerable

# Frontend: check for vulnerable npm packages
cd frontend && npm audit

# Docker: lint Dockerfile for security issues (if hadolint installed)
hadolint deployment/docker/frontend.Dockerfile
```

The Dockerfile runs as non-root (`USER app`). Verify this hasn't been removed after changes.

## MI Path (Default)

### 1. Deploy

```powershell
azd env new mi-test --no-prompt
azd env set ENTRA_SERVICE_MANAGEMENT_REFERENCE "<guid-from-admin>"  # Required by some orgs
azd env set AZURE_LOCATION eastus2 --no-prompt
azd up --no-prompt
```

### 2. Test Remote

```powershell
$endpoint = azd env get-value WEB_ENDPOINT
node deployment/scripts/smoke-test.js $endpoint
```

Verify: health 200, agent name displayed, chat streaming works, token usage visible.

### 3. Test Local Dev

```powershell
cd backend/WebApp.Api
$env:ASPNETCORE_ENVIRONMENT = "Development"  # CRITICAL — without this, uses ManagedIdentityCredential which fails locally
$env:ASPNETCORE_URLS = "http://localhost:8080"
dotnet watch run --no-launch-profile &

cd ../../frontend
npm run dev &

# Wait for both servers, then:
node deployment/scripts/smoke-test.js http://localhost:5173
```

### 4. Teardown

```powershell
azd down --force --purge --environment mi-test --no-prompt
# Verify:
# - frontend/.env.local deleted
# - backend/WebApp.Api/.env deleted
# - .azure/mi-test/ deleted
# - Entra app deleted (check azd logs)
```

## OBO Path

### 1. Deploy

```powershell
azd env new obo-test --no-prompt
azd env set ENABLE_OBO true --no-prompt
azd env set AZURE_LOCATION eastus2 --no-prompt
# No SMR needed if using a non-MSFT tenant
azd up --no-prompt
```

### 2. Verify OBO Wiring

```powershell
# Check backend logs for OBO mode
az containerapp logs show --name <app-name> --resource-group <rg> --type console --tail 20 | Select-String "OBO"
# Expected: "OBO mode enabled: backendClientId=..."
# Expected: "Created OBO credential for request" (after first chat)
```

### 3. Test

Run smoke test. OBO requires interactive MSAL login (user must sign in with test tenant credentials). The smoke test will wait at auth if no cached session exists.

### 4. Teardown

Same as MI path. Additionally verify:
- Backend API app registration deleted (postdown.ps1 handles this)
- FIC removed with the app

## Gotchas

| Gotcha | Detail |
|--------|--------|
| `ASPNETCORE_ENVIRONMENT=Development` | Required for local dev — without it, backend tries ManagedIdentityCredential which fails on dev machines |
| SMR required | Set `ENTRA_SERVICE_MANAGEMENT_REFERENCE` or Entra app creation fails |
| Bicep FIC creation may fail | Graph API eventual consistency issue. Workaround: create FIC via `az ad app federated-credential create` |
| v2 agent API requires `kind: "prompt"` | When creating agents via REST, use `definition: { kind: "prompt", model: "...", instructions: "..." }` |
| OBO scope is `api://{BACKEND}/Chat.ReadWrite` | NOT `api://{SPA}/Chat.ReadWrite`. Token audience mismatch = `AADSTS500131` |
| AI scope resolves to Azure ML Services | `https://ai.azure.com/.default` → appId `18a66f5f-...` (Azure Machine Learning Services), NOT `7d312290-...` (Cognitive Services) |
| Conversation history not user-scoped in MI mode | MI uses shared identity — all users see all conversations |

## Related Skills

- **testing-with-playwright** — Playwright MCP patterns for interactive testing
- **validating-ui-features** — Step-by-step UI feature validation
- **deploying-to-azure** — azd commands and troubleshooting
- **troubleshooting-authentication** — MSAL/JWT debugging
