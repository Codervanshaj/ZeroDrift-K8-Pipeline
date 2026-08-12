# ZeroDrift — Production GitOps Platform

[![CI Backend](https://github.com/Codervanshaj/ZeroDrift-K8-Pipeline/actions/workflows/ci-backend.yml/badge.svg)](https://github.com/Codervanshaj/ZeroDrift-K8-Pipeline/actions/workflows/ci-backend.yml)
[![CI Frontend](https://github.com/Codervanshaj/ZeroDrift-K8-Pipeline/actions/workflows/ci-frontend.yml/badge.svg)](https://github.com/Codervanshaj/ZeroDrift-K8-Pipeline/actions/workflows/ci-frontend.yml)
[![ArgoCD](https://img.shields.io/badge/ArgoCD-GitOps-blue?logo=argo)](https://argoproj.github.io/cd/)
[![Kyverno](https://img.shields.io/badge/Kyverno-Policy%20Enforced-brightgreen?logo=kubernetes)](https://kyverno.io/)
[![Terraform](https://img.shields.io/badge/Terraform-Bootstrapped-purple?logo=terraform)](https://www.terraform.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Ship code to production multiple times a day with zero downtime, automatic rollback on failure, full observability, enforced compliance policies, and a GitOps workflow that survives failure conditions. Bootstrapped from scratch in under 10 minutes.

---

## The Problem

Modern Kubernetes environments silently degrade:

- Engineers apply `kubectl` hotfixes at 2am — the cluster diverges from Git
- A deployment passes staging but fails production due to environment inconsistencies
- No one knows why a pod restarted last Tuesday — no logs, no traces, no correlated data
- A bad deployment causes 20 minutes of downtime before someone manually rolls back
- Secrets live in plaintext in environment variables or committed to Git

ZeroDrift solves all of this. Git is the sole source of truth, every deployment is progressive with automatic analysis, every secret is encrypted, and every failure is caught before it reaches 100% of traffic.

---

## Architecture

```
                    +----------------------------------+
                    |         Git Repository           |
                    |   (single source of truth)      |
                    +----------------+-----------------+
                                     | push
        +----------------------------+----------------------------+
        |               GitHub Actions CI                        |
        |  lint -> trivy scan -> build -> cosign sign -> push    |
        |                 +-> yq patch values.yaml               |
        +----------------------------+----------------------------+
                                     | git commit (image tag)
        +----------------------------+----------------------------+
        |                    ArgoCD                              |
        |   AppProject -> ApplicationSet -> 4 Apps               |
        |   selfHeal=true    prune=true    syncWaves             |
        +------+---------------------------------+---------------+
               |                                 |
        +------+-----------+         +-----------+-----------+
        |  zero-drift-dev  |         |  zero-drift-prod      |
        |  backend-svc     |         |  backend-svc          |
        |  (Argo Rollout)  |         |  (Argo Rollout)       |
        |  frontend-svc    |         |  frontend-svc         |
        +------+-----------+         +-----------+-----------+
               |                                 |
        +------+---------------------------------+---------------+
        |              nginx Ingress Controller                   |
        +---------------------------------------------------------+

  +-------------------------------------------------------------------+
  |  Infrastructure (deployed via ArgoCD -- also zero-drift)          |
  |  Prometheus | Grafana | Loki | Tempo | Kyverno | Chaos Mesh       |
  +-------------------------------------------------------------------+

  Kyverno validates every resource before API server admission
  Argo Rollouts canary: 10% -> Prometheus analysis -> 50% -> 100% or auto-rollback
  Chaos Mesh: scheduled experiments verify resilience every night
```

> See [docs/architecture.png](docs/architecture.png) for the visual architecture diagram.

---

## Key Capabilities

| Capability | Implementation | What It Proves |
|---|---|---|
| **Progressive Delivery** | Argo Rollouts canary with Prometheus AnalysisTemplate | New versions validated against real traffic before full rollout |
| **Automatic Rollback** | AnalysisTemplate with `successCondition: result[0] >= 0.95` | Bad deployments revert without human intervention |
| **Policy Enforcement** | Kyverno ClusterPolicies (validation + mutation) | No non-compliant resource can ever reach the cluster |
| **Image Signing** | Cosign keyless signing via GitHub OIDC | Only images built by your CI pipeline can be deployed |
| **Full Observability** | Prometheus + Loki + Tempo + Grafana unified dashboards | Any incident debugged from metrics to logs to traces |
| **SLO Error Budgets** | 30-day availability and latency SLOs in PromQL | Real SRE work — error budget math, burn rate alerts |
| **Chaos Validation** | Chaos Mesh scheduled experiments | Resilience is continuously proven, not assumed |
| **Encrypted Secrets** | Sealed Secrets via kubeseal | Zero plaintext secrets in Git, ever |
| **Self-Bootstrapping** | Terraform modules with explicit dependency ordering | A fresh cluster is fully operational in under 10 minutes |
| **Multi-Environment** | ApplicationSet matrix (2 services x 2 envs) with prod gate | Dev auto-deploys; prod requires a reviewed, approved PR |

---

## Repository Structure

```
ZeroDrift-K8-Pipeline/
+-- .github/workflows/
|   +-- ci-backend.yml           # CI: lint -> trivy -> build -> cosign sign -> push -> yq patch
|   +-- ci-frontend.yml          # CI: same pipeline for frontend-service
|   +-- promote-prod.yml         # Manual prod promotion via PR + environment gate
|
+-- app/
|   +-- backend-service/         # Node.js API — efficiency metrics, OTel traces, pino logs
|   |   +-- server.js            # Express: /api/efficiency, /metrics, /api/fail, /api/slow
|   |   +-- instrumentation.js   # OpenTelemetry SDK bootstrap (OTLP -> Tempo)
|   |   +-- Dockerfile           # Multi-stage, non-root, build args for git SHA
|   +-- frontend-service/        # Node.js/Vite — Kube-Optima dashboard UI
|       +-- server.js            # Express proxy: /api/* -> backend-service
|       +-- src/                 # React dashboard components
|       +-- Dockerfile
|
+-- helm/
|   +-- backend-service/
|   |   +-- templates/
|   |   |   +-- rollout.yaml           # Argo Rollout with canary steps
|   |   |   +-- analysis-template.yaml # Prometheus success-rate check
|   |   |   +-- service.yaml           # Stable + canary services
|   |   |   +-- servicemonitor.yaml    # Prometheus scrape config
|   |   |   +-- networkpolicy.yaml     # Deny-by-default with explicit allows
|   |   +-- values.yaml          # Base values (image tag updated by CI)
|   |   +-- values-dev.yaml      # Dev overrides: 1 replica, auto-sync
|   |   +-- values-prod.yaml     # Prod overrides: 3 replicas, HPA, PDB
|   +-- frontend-service/        # Mirror structure
|
+-- argocd/
|   +-- project.yaml             # AppProject: RBAC, source repos, namespace whitelist
|   +-- applicationset.yaml      # Matrix generator: 2 services x 2 envs = 4 Applications
|   +-- infra/
|       +-- monitoring-stack.yaml
|       +-- loki-stack.yaml
|       +-- tempo.yaml
|       +-- kyverno.yaml
|       +-- chaos-mesh.yaml
|
+-- terraform/
|   +-- backend.tf               # Terraform Cloud remote state
|   +-- main.tf                  # Module orchestration with explicit depends_on
|   +-- variables.tf
|   +-- outputs.tf
|   +-- modules/
|       +-- argocd/
|       +-- argo-rollouts/
|       +-- kyverno/
|       +-- sealed-secrets/
|
+-- policies/
|   +-- require-trusted-registry.yaml
|   +-- require-resource-limits.yaml
|   +-- add-standard-labels.yaml
|   +-- verify-image-signature.yaml
|
+-- monitoring/
|   +-- dashboards/
|   |   +-- platform-overview.json
|   |   +-- slo-error-budget.json
|   +-- alert-rules.yaml
|
+-- chaos/
|   +-- pod-failure-dev.yaml
|   +-- network-latency-dev.yaml
|   +-- cpu-stress-dev.yaml
|
+-- secrets/
|   +-- grafana-admin-sealed.yaml
|   +-- argocd-notifications-sealed.yaml
|   +-- README.md
|
+-- docs/
    +-- architecture.svg
    +-- adr/                     # 5 Architecture Decision Records
    +-- runbook/                 # 5 operational runbooks
```

---

## Setup Guide — Bootstrap from Zero

> **Prerequisites**: Docker Desktop with Kubernetes enabled (or any K8s cluster), Terraform CLI, kubectl, Helm 3.

### Step 1 — Fork and Clone

```bash
# 1. Click Fork on the GitHub repo page (top-right button)
# 2. Clone your fork
git clone https://github.com/YOUR-GITHUB-USERNAME/ZeroDrift-K8-Pipeline.git
cd ZeroDrift-K8-Pipeline
```

The ArgoCD ApplicationSet references the repo URL to pull Helm charts. It must point to your fork.

---

### Step 2 — Configure GitHub Repository Secrets

Go to your fork: **Settings → Secrets and variables → Actions → New repository secret**

| Secret Name | Value | Where to Get It |
|---|---|---|
| `DOCKERHUB_USERNAME` | Your Docker Hub username | hub.docker.com |
| `DOCKERHUB_TOKEN` | Docker Hub access token | hub.docker.com → Account Settings → Security → Access Tokens → Create |

**Set up the Production Environment Gate:**
1. **Settings → Environments → New environment** → name it `production`
2. Under Deployment protection rules → check **Required reviewers** → add yourself
3. This gates the promote-prod.yml workflow — every prod deploy needs manual approval

---

### Step 3 — Update Repository References (Your Username)

Use VS Code Find & Replace across files (Ctrl+Shift+H, check "In All Files"):

**Replace** `Codervanshaj/ZeroDrift-K8-Pipeline` **with** `YOUR-USERNAME/ZeroDrift-K8-Pipeline`:
- `argocd/applicationset.yaml` — the `repoURL` field
- `argocd/project.yaml` — the `sourceRepos` field

**Replace** `vanshajagarwal` **with your Docker Hub username**:
- `helm/backend-service/values.yaml` — `image.repository`
- `helm/frontend-service/values.yaml` — `image.repository`
- `policies/require-trusted-registry.yaml` — the image registry pattern
- `policies/verify-image-signature.yaml` — `imageReferences` and `subject` (also update the GitHub workflow URL)

**Update `terraform/backend.tf`:**
```hcl
terraform {
  cloud {
    organization = "your-terraform-cloud-org-name"
    workspaces {
      name = "ZeroDrift-K8-Pipeline"
    }
  }
}
```

---

### Step 4 — Set Up Terraform Cloud (Remote State)

1. Create a free account at https://app.terraform.io
2. Create an **organization** (any name — use it in backend.tf)
3. Create a **workspace**: New workspace → CLI-driven workflow → name it `ZeroDrift-K8-Pipeline`
4. Authenticate your local Terraform CLI:

```bash
terraform login
# A browser tab opens -> log in to app.terraform.io -> create a token -> paste it back
```

---

### Step 5 — Configure Your Kubernetes Context

```bash
# See all available contexts
kubectl config get-contexts

# Use Docker Desktop Kubernetes (recommended for local testing)
kubectl config use-context docker-desktop

# Confirm cluster is reachable
kubectl cluster-info
kubectl get nodes    # Should show node(s) in Ready state
```

**Enable Kubernetes in Docker Desktop:** Settings → Kubernetes → check "Enable Kubernetes" → Apply & Restart (wait ~2 minutes).

If your context name differs from `docker-desktop`, edit `terraform/variables.tf`:
```hcl
variable "kube_context" {
  default = "your-actual-context-name"
}
```

---

### Step 6 — Bootstrap the Platform with Terraform

```bash
cd terraform

terraform init     # Downloads providers, connects to Terraform Cloud
terraform plan     # Preview: should show ~40 resources to create
terraform apply    # Type yes when prompted — takes 8-12 minutes
```

**Bootstrap order enforced by `depends_on`:**
1. **Sealed Secrets controller** — so SealedSecrets can be decrypted
2. **Argo Rollouts** — CRDs must exist before Rollout resources
3. **Kyverno** — admission controller active before any app is deployed
4. **ArgoCD** — installed with AppProject and ApplicationSet registered
5. ArgoCD syncs: monitoring stack, chaos mesh, and application services

If `terraform apply` fails mid-way, just run it again — Terraform is idempotent.

---

### Step 7 — Verify the Bootstrap

```bash
# Check all namespaces
kubectl get pods -n argocd
kubectl get pods -n sealed-secrets
kubectl get pods -n argo-rollouts
kubectl get pods -n kyverno

# Access ArgoCD UI
kubectl port-forward svc/argocd-server -n argocd 8080:443
# Open: https://localhost:8080  (accept the self-signed cert warning)

# Get initial admin password
# Linux/macOS:
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d

# Windows PowerShell:
# $enc = kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}"
# [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($enc))

# Login: username=admin, password=<above output>
```

In ArgoCD UI you should see 4 Applications syncing (may take 5-10 minutes to go green):
- `backend-service-dev`
- `backend-service-prod`
- `frontend-service-dev`
- `frontend-service-prod`

---

### Step 8 — Seal Your Secrets

The `secrets/` folder contains placeholder SealedSecrets sealed with the original cluster's key. You **must** re-seal them for your cluster or they will fail to decrypt.

```bash
# Install kubeseal
# Windows (Scoop):  scoop install kubeseal
# macOS:            brew install kubeseal
# Linux: download binary from https://github.com/bitnami-labs/sealed-secrets/releases

# Fetch YOUR cluster's public certificate
kubeseal --fetch-cert \
  --controller-name=sealed-secrets \
  --controller-namespace=sealed-secrets \
  > sealed-secrets-cert.pem

# Create and seal the Grafana admin secret (pick a strong password)
kubectl create secret generic grafana-admin-secret \
  --from-literal=admin-password="YourStrongPassword123!" \
  --dry-run=client -o yaml | \
kubeseal --cert sealed-secrets-cert.pem \
  --format yaml > secrets/grafana-admin-sealed.yaml

# Commit the new sealed secret
git add secrets/grafana-admin-sealed.yaml
git commit -m "chore: re-seal grafana admin secret for this cluster"
git push

# Delete the cert file - NEVER commit this
Remove-Item sealed-secrets-cert.pem    # Windows PowerShell
# rm sealed-secrets-cert.pem           # Linux/macOS
```

See `secrets/README.md` for sealing the ArgoCD notifications secret.

---

### Step 9 — Access the Application and Dashboards

Once ArgoCD shows all applications as **Synced** and **Healthy**:

```bash
# Grafana — metrics, logs, traces, SLO dashboards
kubectl port-forward svc/kube-prometheus-stack-grafana -n monitoring 3000:80
# Open: http://localhost:3000
# Username: admin
# Password: the one you sealed in Step 8

# Kube-Optima frontend dashboard (the application itself)
kubectl port-forward svc/frontend-service-stable -n zero-drift-dev 8080:80
# Open: http://localhost:8080

# Backend API directly
kubectl port-forward svc/backend-service-stable -n zero-drift-dev 3001:80
curl http://localhost:3001/api/efficiency
```

---

### Step 10 — Trigger the CI Pipeline

Make any code change to kick off the full pipeline:

```bash
# Touch the backend source to trigger CI
echo "# build" >> app/backend-service/server.js

git add app/backend-service/server.js
git commit -m "feat: trigger CI pipeline"
git push origin main
```

**What happens automatically:**
1. GitHub Actions: lint → Trivy scan → Docker build → Cosign sign → Docker Hub push → `yq` updates `values.yaml` → git commit to `main`
2. ArgoCD detects changed `values.yaml` → triggers Application sync
3. Argo Rollouts starts canary: routes 10% traffic to the new version
4. `AnalysisTemplate` queries Prometheus 3 times at 60-second intervals: `success_rate >= 95%`?
5. Pass: promotes to 50% → checks again → promotes to 100%
6. Fail: **automatic rollback** to stable — zero human intervention needed

```bash
# Watch the canary in real-time (separate terminal)
kubectl argo rollouts get rollout backend-service -n zero-drift-dev --watch
```

---

### Step 11 — Demo: Automatic Rollback on Failure

This is the centrepiece demo of ZeroDrift:

```bash
# 1. Edit helm/backend-service/values-dev.yaml
#    Change:   FORCE_ERRORS: "false"
#    To:       FORCE_ERRORS: "true"
#    This makes /api/efficiency return HTTP 500 errors

git add helm/backend-service/values-dev.yaml
git commit -m "feat: simulate bad deployment"
git push origin main

# 2. Watch the rollout in a separate terminal
kubectl argo rollouts get rollout backend-service -n zero-drift-dev --watch

# What you will observe:
# - Canary starts at 10% traffic
# - AnalysisRun fires -> /api/efficiency returns 500s -> success_rate = 0%
# - Analysis FAILS (failureLimit: 1 means one failure triggers abort)
# - Rollout status: AbortedRollback
# - Traffic reverts 100% to previous stable version
# - Zero downtime throughout the experiment

# 3. Revert to restore healthy state
git revert HEAD --no-edit
git push origin main
```

---

### Step 12 — Promote to Production

1. GitHub → **Actions** tab → **Promote to Production** workflow → **Run workflow**
2. Enter the image tag to promote (visible in CI output, e.g., `a3f9d1c`)
3. Workflow creates branch `promote-prod-<tag>` and opens a PR updating `values-prod.yaml` for both services
4. Review the PR — verify both service prod values are updated
5. The `production` environment gate fires — approve the deployment as the required reviewer
6. Merge the PR into `main`
7. In ArgoCD UI: click `backend-service-prod` → **Sync**, then `frontend-service-prod` → **Sync**
   (`autoSync: false` for prod — each sync is a deliberate, audited action)

---

## Design Decisions

| ADR | Decision | Why |
|---|---|---|
| [ADR-001](docs/adr/ADR-001-argo-rollouts-vs-flagger.md) | Argo Rollouts over Flagger | Native ArgoCD integration; Prometheus analysis is more flexible |
| [ADR-002](docs/adr/ADR-002-kyverno-vs-opa-gatekeeper.md) | Kyverno over OPA Gatekeeper | Native Kubernetes resources; no Rego language required |
| [ADR-003](docs/adr/ADR-003-loki-vs-elasticsearch.md) | Loki over Elasticsearch | Cost-efficient; indexes only labels, not full log content |
| [ADR-004](docs/adr/ADR-004-sealed-secrets-vs-external-secrets.md) | Sealed Secrets over External Secrets | No external dependency (Vault, AWS SM) required for bootstrapping |
| [ADR-005](docs/adr/ADR-005-terraform-boundary.md) | Terraform for bootstrap only | Terraform owns prerequisites; ArgoCD owns everything else |

---

## Operational Runbooks

| Runbook | Use When |
|---|---|
| [Rollback a Deployment](docs/runbook/rollback-a-deployment.md) | A promoted canary is causing production issues |
| [Promote to Production](docs/runbook/promote-to-prod.md) | Step-by-step prod promotion guide |
| [Debug with Traces](docs/runbook/debug-with-traces.md) | Tracing a slow request from Grafana to Tempo to Loki |
| [Error Budget Response](docs/runbook/error-budget-response.md) | SLO burn rate alert fires |
| [Chaos Experiment Guide](docs/runbook/chaos-experiment-guide.md) | Running or pausing a scheduled Chaos Mesh experiment |

---

## Monitoring and SLOs

**Grafana Dashboards** (port-forward Grafana to localhost:3000):

| Dashboard | Purpose |
|---|---|
| Platform Overview | Request rate, error rate, P95 latency, active rollouts, policy violations, drift events |
| SLO Error Budget | 30-day availability and latency SLO burn rate with error budget remaining |

**Service Level Objectives:**

| SLO | Target | Window | Alert |
|---|---|---|---|
| Availability | 99.5% of requests return 2xx/3xx | 30 days | `ErrorBudgetBurnRate` — error rate > 0.5% for 5m |
| Latency | P95 < 500ms | 30 days | `LatencySLOBreach` — P95 > 500ms for 5m |

---

## Chaos Engineering Schedule

All experiments target `zero-drift-dev` only. Never run against prod.

| Experiment | Cron | What Is Tested |
|---|---|---|
| Pod Failure | Mon–Fri at 22:00 | K8s + ArgoCD restore pod; SLO stays within budget |
| Network Latency +300ms | Wed at 22:30 | Latency SLO alert fires and auto-resolves |
| CPU Stress 80% | Thu at 23:00 | HPA scales from 1 to 3 replicas |

```bash
# Manually trigger an experiment
kubectl apply -f chaos/pod-failure-dev.yaml -n chaos-testing

# Pause an experiment
kubectl annotate podchaos backend-service-pod-failure \
  chaos-mesh.org/pause=true -n chaos-testing

# List all active experiments
kubectl get podchaos,networkchaos,stresschaos -n chaos-testing
```

---

## Security Model

| Control | Implementation | Enforcement Point |
|---|---|---|
| Image signing | Cosign keyless via GitHub OIDC | Kyverno `verifyImages` — unsigned images rejected at admission |
| Registry allowlist | Kyverno `require-trusted-registry` | Pods from unknown registries rejected |
| Resource limits | Kyverno `require-resource-limits` | Pods without CPU/memory limits rejected |
| Encrypted secrets | Sealed Secrets (kubeseal) | No plaintext in Git; decrypted only inside cluster |
| Network isolation | `NetworkPolicy` in Helm chart | Backend unreachable except from frontend and Prometheus |
| Vulnerability gate | Trivy in CI with `--exit-code 1` on HIGH/CRITICAL | Build fails before push if vulnerable packages found |

---

## Troubleshooting

**ArgoCD shows OutOfSync after terraform apply:**
```bash
kubectl -n argocd exec deploy/argocd-server -- argocd app sync backend-service-dev --force
# Or in ArgoCD UI: click Refresh then Sync
```

**terraform apply fails — Kyverno rejecting resources:**
```bash
kubectl get policyreport -A
# Temporarily set the blocking policy to Audit mode
kubectl patch clusterpolicy require-resource-limits \
  --type=merge -p '{"spec":{"validationFailureAction":"Audit"}}'
```

**Argo Rollout stuck at 10% — AnalysisRun Inconclusive:**
```bash
kubectl get analysisrun -n zero-drift-dev
kubectl describe analysisrun <NAME> -n zero-drift-dev
# Cause: Prometheus has no data yet (no traffic on the canary)
# Fix: Generate load, or wait 3 minutes and retry
```

**ServiceMonitor not picked up by Prometheus:**
```bash
kubectl get servicemonitor -n zero-drift-dev
kubectl get prometheus -n monitoring -o yaml | grep -A5 serviceMonitorSelector
# ServiceMonitor must have label: release: kube-prometheus-stack
```

**kubeseal fails — cannot fetch certificate:**
```bash
kubectl get pods -n sealed-secrets
kubectl port-forward svc/sealed-secrets -n sealed-secrets 8081:8080 &
kubeseal --fetch-cert \
  --controller-name=sealed-secrets \
  --controller-namespace=sealed-secrets
```

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit with Conventional Commits: `git commit -m "feat: describe your change"`
4. Push and open a pull request against `main`
5. CI runs automatically — all checks must pass before merge

---

## License

MIT
