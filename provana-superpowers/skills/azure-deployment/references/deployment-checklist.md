# Azure Deployment Checklist
<!-- Pre-go-live verification. Complete before declaring any environment ready. -->

## Foundation

- [ ] Resource group created with correct tags (`project`, `environment`, `managed-by`)
- [ ] Log Analytics workspace created and receiving test events
- [ ] `.env.azure.[env]` file generated and committed to secrets vault (not git)

## Networking

- [ ] VNet created with correct address space (`10.0.0.0/16`)
- [ ] All required subnets provisioned (aks, private-endpoint, functions, appgw)
- [ ] NSGs attached to AKS/functions subnets — internet ingress blocked
- [ ] NSG rules tested: `az network watcher check-connectivity`

## Container Registry

- [ ] ACR created with `--admin-enabled false`
- [ ] Private endpoint created and DNS zone group configured
- [ ] `nslookup [acr].azurecr.io` resolves to private IP (not 20.x.x.x)
- [ ] ACR reachable from AKS/Container Apps via Managed Identity
- [ ] `az acr check-health --name [acr]` — all checks pass
- [ ] Test push: `docker push [acr].azurecr.io/test:latest` succeeds

## Storage Account

- [ ] Public network access disabled
- [ ] Private endpoint created for blob
- [ ] DNS resolves to private IP from within VNet
- [ ] Application containers created (documents, processed, exports)
- [ ] RBAC assignments verified: app MI has `Storage Blob Data Contributor`

## PostgreSQL

- [ ] Server created with private DNS zone
- [ ] Public access disabled
- [ ] `az postgres flexible-server connect` succeeds from within VNet
- [ ] pgvector extension enabled: `SELECT * FROM pg_extension WHERE extname = 'vector';`
- [ ] High availability mode matches environment (ZoneRedundant for prod)
- [ ] Admin password stored in Key Vault (not in `.env` file)
- [ ] Application database created
- [ ] Backup retention set (7+ days prod, 3+ days non-prod)

## Key Vault

- [ ] RBAC model enabled (`--enable-rbac-authorization true`)
- [ ] Private endpoint created and DNS zone group configured
- [ ] All application secrets stored (db-connection-string, openai-api-key, speech-key, appinsights-connection-string)
- [ ] Each application MI has `Key Vault Secrets User` role
- [ ] Verify: `az keyvault secret show --vault-name [kv] --name db-connection-string` returns value

## Function App / Container Apps

- [ ] VNet integration enabled (outbound)
- [ ] Managed Identity assigned and has required role assignments
- [ ] Key Vault references working (not showing `@Microsoft.KeyVault(...)` in app settings — should resolve)
- [ ] Health endpoint responds: `curl https://[app-fqdn]/health`
- [ ] Scaling rules configured (min replicas for prod)
- [ ] Deployment slots configured for prod (staging slot for zero-downtime deploy)

## Networking — end-to-end connectivity

- [ ] Container App → PostgreSQL: connection string resolves and connects
- [ ] Container App → Storage: blob upload/download works
- [ ] Container App → Key Vault: secret read works
- [ ] Container App → ACR: image pull works (verify via deploy)
- [ ] Function App → all the above (same checks)

## Public IP and DNS

- [ ] Static public IP allocated and tagged
- [ ] DNS A record created and propagated: `nslookup [domain]` returns correct IP
- [ ] TLS certificate installed and valid: `curl -v https://[domain]` shows valid cert
- [ ] HTTP → HTTPS redirect working: `curl -I http://[domain]` returns 301
- [ ] WAF rules enabled on App Gateway

## Monitoring

- [ ] Application Insights receiving data (deploy one request and verify in portal)
- [ ] Log Analytics receiving container logs
- [ ] Alert rules created: high error rate, PostgreSQL CPU, storage capacity
- [ ] Alert action group configured (email / Teams webhook / PagerDuty)
- [ ] Dashboard created in Azure Monitor

## Security final check

- [ ] `az security assessment list --resource-group [rg]` — no HIGH severity findings
- [ ] No public endpoints on: Storage, PostgreSQL, Key Vault, ACR
- [ ] No credentials in application environment variables (only Key Vault references)
- [ ] No `Owner` or `Contributor` role assignments at subscription scope for app identities
- [ ] Defender for Cloud enabled on subscription

## Post-deployment smoke test

```bash
# Run after every deployment
pytest tests/smoke/ -v --base-url="https://[domain]"
```

Smoke tests must cover:
- [ ] Health check: `GET /health` → 200
- [ ] Auth: unauthenticated request → 401
- [ ] Core workflow: [project-specific] → 200 with expected payload
- [ ] Database connectivity (via health endpoint that queries DB)
