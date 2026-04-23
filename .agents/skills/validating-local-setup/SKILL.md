---
name: validating-local-setup
description: >
  Diagnose and fix incomplete local development setup.
  Use when dev servers fail to start, env vars are missing,
  authentication errors occur, or before running any dev commands
  for the first time.
---

# Local Setup Validation

## Portal vs `azd up` — What Each Provides

The AI Foundry portal's "View sample app code" gives you AI resource variables (`AI_AGENT_ENDPOINT`, `AI_AGENT_ID`), which identify your agent. However, this app also needs an **Entra ID app registration** for user authentication — which only `azd up` creates. Both sets of config are required.

| Source | What It Provides | Config It Generates |
|--------|-----------------|-------------------|
| **AI Foundry portal** | Agent endpoint + agent ID | Root `.env` (or manual `azd env set`) |
| **`azd up`** | Entra app registration, RBAC, infrastructure | `frontend/.env.local` + `backend/WebApp.Api/.env` |

If you came from the portal, paste those values and run `azd up` — it detects them and incorporates them automatically.

## Quick Diagnostic

Run the validation script to check all configuration:

```powershell
pwsh -File deployment/scripts/validate-config.ps1
```

This checks for `frontend/.env.local` and `backend/WebApp.Api/.env` with the core authentication variables. For a full list of required variables, see the tables below.

## What `azd up` Creates

This app requires `azd up` before local development works. Here's what it provisions:

| What | Why | Generated File |
|------|-----|----------------|
| Entra ID app registration | SPA authentication (MSAL.js) | `frontend/.env.local` |
| Backend auth config | JWT token validation | `backend/WebApp.Api/.env` |
| Azure infrastructure | Container Apps, ACR, RBAC | `.azure/<env>/.env` |
| Redirect URIs | Login callback URLs | Entra app registration |

**Even if AI Foundry resources already exist** (e.g., from the portal "View sample app code" flow), `azd up` is still required to create the Entra app registration.

## Required Environment Variables

### Frontend (`frontend/.env.local`)

| Variable | Source | Required |
|----------|--------|----------|
| `VITE_ENTRA_SPA_CLIENT_ID` | Entra app registration (created by `azd up`) | Yes |
| `VITE_ENTRA_TENANT_ID` | Azure AD tenant | Yes |
| `VITE_ENTRA_BACKEND_CLIENT_ID` | Backend app registration (OBO mode only) | No |

### Backend (`backend/WebApp.Api/.env`)

| Variable | Source | Required |
|----------|--------|----------|
| `AzureAd__TenantId` | Azure AD tenant | Yes |
| `AzureAd__ClientId` | Entra app registration | Yes |
| `AzureAd__Audience` | `api://{ClientId}` | Yes |
| `AI_AGENT_ENDPOINT` | AI Foundry project endpoint | Yes |
| `AI_AGENT_ID` | Agent name in Foundry | Yes |

## Common Error Patterns

### "undefined" in login URL
```
login.microsoftonline.com/undefined/oauth2/v2.0/authorize?client_id=undefined
```
**Cause**: `VITE_ENTRA_SPA_CLIENT_ID` and `VITE_ENTRA_TENANT_ID` not set.
**Fix**: Run `azd up` — this creates the Entra app and generates `frontend/.env.local`.

### AADSTS900023: Specified tenant identifier is neither a valid DNS name
**Cause**: Same as above — tenant ID is `undefined` or empty.
**Fix**: Run `azd up`.

### Frontend shows "Setup Required" error page
**Cause**: The Vite env check plugin detected missing environment variables.
**Fix**: Run `azd up`, then restart the dev server.

### 401 Unauthorized on /api/* endpoints
**Cause**: Backend JWT validation failing — check `backend/WebApp.Api/.env`.
**Fix**: Ensure `AzureAd__ClientId` matches the Entra app registration. Run `azd provision` to regenerate.

### ManagedIdentityCredential error in local dev
**Cause**: Backend trying to use managed identity locally.
**Fix**: Set `ASPNETCORE_ENVIRONMENT=Development` — local dev uses `ChainedTokenCredential(AzureCliCredential, AzureDeveloperCliCredential)` instead.

## Step-by-Step Fix for Incomplete Setup

1. **Check current state**:
   ```powershell
   pwsh -File deployment/scripts/validate-config.ps1
   ```

2. **If no `.azure/` directory** (never ran azd):
   ```powershell
   azd up
   ```

3. **If `.azure/` exists but env files missing** (partial setup):
   ```powershell
   azd provision   # Re-creates Entra app + generates .env files
   ```

4. **If env files exist but vars are wrong** (stale config):
   ```powershell
   azd provision   # Regenerates everything
   ```

5. **Restart dev servers** after any fix — env vars are read at startup.

## For Agents: Before Running Dev Commands

Before executing `dotnet watch run`, `npm run dev`, or `start-local-dev.ps1`:

1. Check if `frontend/.env.local` exists
2. Check if `backend/WebApp.Api/.env` exists
3. If either is missing, tell the user to run `azd up` first
4. Do NOT try to create these files manually — they contain auto-generated Entra app registration IDs
