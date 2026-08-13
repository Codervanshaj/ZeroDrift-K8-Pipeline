<div align="center">

# ⚓ ZeroDrift

### Production-Grade GitOps Platform on Kubernetes

[![CI Backend](https://github.com/Codervanshaj/ZeroDrift-K8-Pipeline/actions/workflows/ci-backend.yml/badge.svg)](https://github.com/Codervanshaj/ZeroDrift-K8-Pipeline/actions/workflows/ci-backend.yml)
[![CI Frontend](https://github.com/Codervanshaj/ZeroDrift-K8-Pipeline/actions/workflows/ci-frontend.yml/badge.svg)](https://github.com/Codervanshaj/ZeroDrift-K8-Pipeline/actions/workflows/ci-frontend.yml)
[![ArgoCD](https://img.shields.io/badge/ArgoCD-GitOps-EF7B4D?logo=argo&logoColor=white)](https://argoproj.github.io/cd/)
[![Argo Rollouts](https://img.shields.io/badge/Argo_Rollouts-Canary-EF7B4D?logo=argo&logoColor=white)](https://argoproj.github.io/rollouts/)
[![Kyverno](https://img.shields.io/badge/Kyverno-Policy_Enforced-1A9B4B?logo=kubernetes&logoColor=white)](https://kyverno.io/)
[![Terraform](https://img.shields.io/badge/Terraform-Bootstrapped-7B42BC?logo=terraform&logoColor=white)](https://www.terraform.io/)
[![Grafana](https://img.shields.io/badge/Grafana-Observability-F46800?logo=grafana&logoColor=white)](https://grafana.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

<br/>

> **Ship confidently. Recover automatically. Drift never.**
>
> ZeroDrift is a fully self-healing GitOps platform built on Kubernetes.  
> Git is the single source of truth. Every deployment is canary-analysed against real Prometheus metrics.  
> Bad deploys auto-rollback. Manual `kubectl` changes are auto-reverted. Chaos is scheduled nightly.  
> The entire platform bootstraps from zero with a single `terraform apply`.

<br/>

[**Quick Start**](#-setup-guide--bootstrap-from-zero) · [**Architecture**](#-architecture) · [**Key Features**](#-key-capabilities) · [**Demo Flows**](#-demo-automatic-rollback-on-failure) · [**Runbooks**](#-operational-runbooks)

</div>

---

## The Problem

Modern Kubernetes environments **silently degrade**:

| Problem | Reality |
|---|---|
| `kubectl` hotfixes at 3am | Cluster diverges from Git — no audit trail |
| Works in dev, fails in prod | Environment inconsistencies with no early warning |
| Pod restarted last Tuesday | No correlated metrics, logs, or traces to diagnose |
| Bad deploy causes 20 min outage | Manual rollback is slow, stressful, and error-prone |
| Secrets live in plaintext | In `.env` files, env vars, or committed to Git |
| Someone scaled a deployment by hand | Cluster state silently diverges from declared state forever |

**ZeroDrift eliminates every one of these.** Git is law. Drift is detected and corrected automatically. Every incident is traced, logged, and measured.

---

## Architecture

```
+---------------------------------------------------------------------+
|                        Git Repository                               |
|               (Single Source of Truth -- main branch)              |
+---------------------------+-----------------------------------------+
                             |  git push
                             v
+---------------------------------------------------------------------+
|                    GitHub Actions CI Pipeline                       |
|                                                                     |
|  app/ change detected                                               |
|       |                                                             |
|  Docker Build -> Cosign Sign (keyless OIDC) -> Docker Hub Push     |
|       |                                                             |
|  yq patch helm/values.yaml (image tag) -> git commit -> git push   |
+---------------------------+-----------------------------------------+
                             |  values.yaml changed
                             v
+---------------------------------------------------------------------+
|                         ArgoCD                                      |
|                                                                     |
|   AppProject (zero-drift)                                           |
|        |                                                            |
|        +-- ApplicationSet (dev)  -> zero-drift-dev namespace        |
|        |     +-- backend-service-dev   (autoSync + selfHeal)        |
|        |     +-- frontend-service-dev  (autoSync + selfHeal)        |
|        |                                                            |
|        +-- ApplicationSet (prod) -> zero-drift-prod namespace       |
|        |     +-- backend-service-prod   (manual sync)               |
|        |     +-- frontend-service-prod  (manual sync)               |
|        |                                                            |
|        +-- infra-apps  -> argocd/infra/ (all infra via GitOps)     |
+------------------+-----------------------------+--------------------+
                   |                             |
      +------------v----------+   +-------------v------------------+
      |    zero-drift-dev     |   |         zero-drift-prod         |
      |                       |   |                                 |
      |  backend-service      |   |  backend-service                |
      |  (Argo Rollout)       |   |  (Argo Rollout -- canary)       |
      |   * 1 replica         |   |   * 3 replicas                  |
      |   * canary disabled   |   |   * canary: 10%->50%->100%      |
      |   * stable svc        |   |   * AnalysisTemplate (Prom)     |
      |   * canary svc        |   |   * stable + canary svc         |
      |                       |   |                                 |
      |  frontend-service     |   |  frontend-service               |
      |  (Argo Rollout)       |   |  (Argo Rollout -- canary)       |
      |   * React + Express   |   |   * proxies /api -> backend     |
      |   * proxies /api ->   |   |   * serves React dist/          |
      |     backend-stable    |   |                                 |
      +-----------------------+   +---------------------------------+

+---------------------------------------------------------------------+
|     Shared Infrastructure (managed by ArgoCD via infra-apps)       |
|                                                                     |
|  kube-prometheus-stack | Loki | Tempo | Grafana                    |
|  Kyverno ClusterPolicies | Chaos Mesh                               |
+---------------------------------------------------------------------+

  GitOps Self-Healing:  selfHeal=true -> ArgoCD reverts any manual change
  Canary Analysis:      AnalysisTemplate queries Prometheus every 60s x 3
  Policy Gate:          Kyverno validates every resource at admission time
  Chaos Validation:     Chaos Mesh experiments run Mon-Thu nightly in dev
```

> See [docs/architecture.png](docs/architecture.png) for the visual architecture diagram.

---

## Key Capabilities

| Capability | Implementation | What It Proves |
|---|---|---|
| **GitOps Self-Healing** | ArgoCD `selfHeal: true` on dev apps | Manual `kubectl` changes auto-reverted in seconds |
| **Progressive Delivery** | Argo Rollouts canary: `10% -> 50% -> 100%` | New versions validated against live traffic before full rollout |
| **Prometheus-Gated Rollout** | `AnalysisTemplate`: `success_rate >= 0.95` every 60s x 3 | Bad deployments revert automatically -- zero human intervention |
| **Multi-Environment GitOps** | Two `ApplicationSet`s -- dev (autoSync) + prod (manual) | Dev ships fast; prod is deliberate and audited |
| **Production Gate** | `promote-prod.yml` + GitHub Environment `production` | Every prod deploy is reviewed, approved, and PR-tracked |
| **Policy Enforcement** | 4 Kyverno `ClusterPolicy` resources in `Enforce` mode | Non-compliant resources rejected at the Kubernetes admission layer |
| **Image Signing** | Cosign keyless signing via GitHub OIDC on every CI build | Only images built by your CI pipeline can ever run in the cluster |
| **Full Observability** | Prometheus + Loki + Tempo + Grafana | Request rate, error rate, P95 latency, traces, logs -- all correlated |
| **SLO Error Budgets** | `PrometheusRule` alerting on 30-day availability & latency SLOs | Real SRE discipline: burn rate alerts fire before budget is gone |
| **Chaos Engineering** | Chaos Mesh: pod failure, network latency, CPU stress | Resilience is continuously proven, not assumed |
| **Encrypted Secrets** | Terraform-provisioned Kubernetes secret for Grafana | Zero plaintext secrets in Git, ever |
| **Self-Bootstrapping** | Terraform modules with explicit `depends_on` ordering | A fresh cluster is fully operational in under 10 minutes |

---

## Repository Structure

```
ZeroDrift-K8-Pipeline/
|
+-- .github/
|   +-- workflows/
|       +-- ci-backend.yml          # Triggered on app/backend-service/** changes
|       |                           # Steps: build -> cosign sign -> docker push -> yq patch -> git push
|       +-- ci-frontend.yml         # Mirror pipeline for frontend-service
|       +-- promote-prod.yml        # Manual dispatch: patches values-prod.yaml, creates PR
|
+-- app/
|   +-- backend-service/            # Node.js Express API
|   |   +-- server.js               # Routes: /api/efficiency /api/fail /api/slow /metrics /healthz /readyz
|   |   +-- instrumentation.js      # OpenTelemetry SDK (OTLP -> Tempo)
|   |   +-- package.json
|   |   +-- Dockerfile              # Multi-stage, non-root, PORT=3000
|   |
|   +-- frontend-service/           # Vite + React dashboard (Kube-Optima)
|       +-- server.cjs              # Express: serves dist/, proxies /api/* -> backend-service-stable
|       +-- instrumentation.cjs     # OpenTelemetry SDK
|       +-- src/
|       |   +-- App.jsx             # Efficiency dashboard -- fetches /api/efficiency
|       |   +-- App.css
|       |   +-- main.jsx
|       +-- vite.config.js
|       +-- index.html
|       +-- Dockerfile              # Multi-stage Vite build -> Express serve, PORT=8080
|
+-- helm/
|   +-- backend-service/
|   |   +-- Chart.yaml
|   |   +-- values.yaml             # Base: image repo/tag, resources, env, probes
|   |   +-- values-dev.yaml         # Dev: replicaCount=1, canary.enabled=false
|   |   +-- values-prod.yaml        # Prod: replicaCount=3, canary.enabled=true
|   |   +-- templates/
|   |       +-- rollout.yaml        # Argo Rollout: canary steps, stable/canary services
|   |       +-- analysis-template.yaml  # PromQL: success_rate >= 0.95, 60s x 3
|   |       +-- service.yaml        # ClusterIP stable + canary services
|   |       +-- servicemonitor.yaml # Prometheus scrape (label: release: kube-prometheus-stack)
|   |       +-- networkpolicy.yaml  # Deny-by-default; allow: frontend->backend, Prometheus->/metrics
|   |
|   +-- frontend-service/           # Mirror structure
|       +-- values.yaml             # BACKEND_URL: http://backend-service-stable
|       +-- values-dev.yaml
|       +-- values-prod.yaml
|       +-- templates/
|           +-- rollout.yaml
|           +-- analysis-template.yaml
|           +-- service.yaml
|           +-- servicemonitor.yaml
|           +-- networkpolicy.yaml
|
+-- argocd/
|   +-- project.yaml                # AppProject: RBAC, source repo whitelist, namespace whitelist
|   +-- applicationset.yaml         # Two ApplicationSets: dev (autoSync+selfHeal) and prod (manual)
|   +-- infra-apps.yaml             # App-of-apps: syncs argocd/infra/ directory
|   +-- infra/
|       +-- monitoring-stack.yaml   # kube-prometheus-stack via ArgoCD
|       +-- loki-stack.yaml         # Grafana Loki
|       +-- tempo.yaml              # Grafana Tempo (distributed tracing)
|       +-- kyverno-policies.yaml   # Kyverno + policies/ directory
|       +-- chaos-mesh.yaml         # Chaos Mesh controller
|
+-- terraform/
|   +-- backend.tf                  # Local state (Terraform Cloud optional)
|   +-- providers.tf                # kubernetes + helm providers
|   +-- main.tf                     # Modules: argo-rollouts -> kyverno -> argocd (ordered)
|   +-- variables.tf                # kube_context, argocd_chart_version, grafana_admin_password
|   +-- outputs.tf
|   +-- modules/
|       +-- argo-rollouts/          # Helm release: argo-rollouts
|       +-- kyverno/                # Helm release: kyverno
|       +-- argocd/                 # Helm release + AppProject + ApplicationSet + infra-apps
|
+-- policies/
|   +-- require-trusted-registry.yaml   # Enforce: images from docker.io/vanshajagarwal/* or ghcr.io
|   +-- require-resource-limits.yaml    # Enforce: all pods must declare CPU + memory limits
|   +-- add-standard-labels.yaml        # Mutate: auto-add app/env labels to pods
|   +-- verify-image-signature.yaml     # Enforce: Cosign signature must be valid
|
+-- monitoring/
|   +-- alert-rules.yaml            # PrometheusRule: ErrorBudgetBurnRate, RolloutDegraded
|   +-- dashboards/
|       +-- platform-overview.yaml  # Grafana: request rate, error rate, P95, rollout status
|       +-- slo-error-budget.yaml   # Grafana: 30-day SLO burn rate + budget remaining
|
+-- chaos/
|   +-- pod-failure-dev.yaml        # PodChaos: random pod kill in zero-drift-dev
|   +-- network-latency-dev.yaml    # NetworkChaos: +300ms latency in zero-drift-dev
|   +-- cpu-stress-dev.yaml         # StressChaos: 80% CPU in zero-drift-dev
|
+-- docs/
    +-- architecture.png            # Visual architecture diagram
    +-- adr/                        # 5 Architecture Decision Records
    |   +-- ADR-001-argo-rollouts-vs-flagger.md
    |   +-- ADR-002-kyverno-vs-opa-gatekeeper.md
    |   +-- ADR-003-loki-vs-elasticsearch.md
    |   +-- ADR-004-sealed-secrets-vs-external-secrets.md
    |   +-- ADR-005-terraform-boundary.md
    +-- runbook/                    # 5 operational runbooks
        +-- rollback-a-deployment.md
        +-- promote-to-prod.md
        +-- debug-with-traces.md
        +-- error-budget-response.md
        +-- chaos-experiment-guide.md
```

---

## Setup Guide -- Bootstrap from Zero

> **Prerequisites:** Docker Desktop with Kubernetes enabled (or any K8s cluster), Terraform CLI, `kubectl`, `helm` 3, `yq`.

### Step 1 -- Fork and Clone

```bash
# 1. Click "Fork" on the GitHub repo page (top-right)
# 2. Clone your fork locally
git clone https://github.com/YOUR-USERNAME/ZeroDrift-K8-Pipeline.git
cd ZeroDrift-K8-Pipeline
```

The ArgoCD ApplicationSet references this repo URL. It **must** point to your fork.

---

### Step 2 -- Configure GitHub Repository Secrets

Go to your fork: **Settings -> Secrets and variables -> Actions -> New repository secret**

| Secret Name | Value | Where to Get It |
|---|---|---|
| `DOCKERHUB_USERNAME` | Your Docker Hub username | hub.docker.com |
| `DOCKERHUB_TOKEN` | Docker Hub access token | hub.docker.com -> Account Settings -> Security -> Access Tokens |

**Set up the Production Environment Gate:**
1. **Settings -> Environments -> New environment** -> name it `production`
2. Under **Deployment protection rules** -> check **Required reviewers** -> add yourself
3. This gates `promote-prod.yml` -- every prod deploy requires manual approval

---

### Step 3 -- Update Repository References

Use VS Code **Find & Replace in all files** (`Ctrl+Shift+H`):

**Replace** `Codervanshaj/ZeroDrift-K8-Pipeline` **with** `YOUR-USERNAME/ZeroDrift-K8-Pipeline`:
- `argocd/applicationset.yaml` -- the `repoURL` field (2 occurrences)
- `argocd/project.yaml` -- the `sourceRepos` field
- `argocd/infra-apps.yaml` -- the `repoURL` field

**Replace** `vanshajagarwal` **with your Docker Hub username**:
- `helm/backend-service/values.yaml` -- `image.repository`
- `helm/frontend-service/values.yaml` -- `image.repository`
- `policies/require-trusted-registry.yaml` -- the image registry pattern
- `policies/verify-image-signature.yaml` -- `imageReferences` and OIDC `subject`

---

### Step 4 -- Configure Your Kubernetes Context

```bash
# List all available contexts
kubectl config get-contexts

# Use Docker Desktop Kubernetes (recommended for local)
kubectl config use-context docker-desktop

# Confirm the cluster is reachable
kubectl cluster-info
kubectl get nodes   # Should show node(s) in Ready state
```

> **Enable Kubernetes in Docker Desktop:** Settings -> Kubernetes -> Enable Kubernetes -> Apply & Restart (wait ~2 min).

If your context name differs from `docker-desktop`, update `terraform/variables.tf`:

```hcl
variable "kube_context" {
  default = "your-actual-context-name"
}
```

---

### Step 5 -- Bootstrap the Platform with Terraform

```bash
cd terraform

terraform init     # Download providers
terraform plan     # Preview: ~25 resources to create
terraform apply    # Type yes -- takes 8-12 minutes
```

**Bootstrap order enforced by `depends_on` in `main.tf`:**

```
1. monitoring namespace + grafana-admin-secret   (Kubernetes secret provisioned by Terraform)
2. Argo Rollouts module                          (CRDs must exist before Rollout resources)
3. Kyverno module                                (Admission controller active before apps deploy)
4. ArgoCD module                                 (Registers AppProject, ApplicationSet, infra-apps)
   +-- ArgoCD syncs infra-apps -> monitoring, loki, tempo, chaos-mesh
   +-- ArgoCD syncs ApplicationSets -> backend-service and frontend-service (dev + prod)
```

> Terraform is idempotent. If `terraform apply` fails mid-way, run it again.

---

### Step 6 -- Verify the Bootstrap

```bash
# Confirm all control-plane components are running
kubectl get pods -n argocd
kubectl get pods -n argo-rollouts
kubectl get pods -n kyverno
kubectl get pods -n monitoring
kubectl get pods -n chaos-testing

# Access ArgoCD UI
kubectl port-forward svc/argocd-server -n argocd 8080:443
# Open: https://localhost:8080  (accept the self-signed cert warning)

# Get the initial admin password (PowerShell)
$enc = kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}"
[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($enc))

# Get the initial admin password (Linux / macOS)
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
```

In the ArgoCD UI you should see these applications syncing (may take 5-10 min to go green):

| Application | Namespace | Sync Policy |
|---|---|---|
| `backend-service-dev` | `zero-drift-dev` | Auto + selfHeal |
| `frontend-service-dev` | `zero-drift-dev` | Auto + selfHeal |
| `backend-service-prod` | `zero-drift-prod` | Manual |
| `frontend-service-prod` | `zero-drift-prod` | Manual |
| `infra-apps` | `argocd` | Auto + selfHeal |

---

### Step 7 -- Access the Application and Dashboards

Once ArgoCD shows all applications as **Synced** and **Healthy**:

```bash
# Grafana (metrics, logs, traces, SLO dashboards)
kubectl port-forward svc/kube-prometheus-stack-grafana -n monitoring 3000:80
# Open: http://localhost:3000
# Username: admin   Password: AdminPass123! (or value set in terraform/variables.tf)

# Kube-Optima Frontend (dev)
kubectl port-forward svc/frontend-service-dev-stable -n zero-drift-dev 5000:80
# Open: http://localhost:5000

# Kube-Optima Frontend (prod)
kubectl port-forward svc/frontend-service-prod-stable -n zero-drift-prod 8081:80
# Open: http://localhost:8081

# Backend API (dev) -- direct access
kubectl port-forward svc/backend-service-dev-stable -n zero-drift-dev 3001:80
curl http://localhost:3001/api/efficiency
curl http://localhost:3001/metrics
```

> **Service naming convention:** Services follow the pattern `{helm-release-name}-stable` and `{helm-release-name}-canary`.
> Helm release names are `backend-service-dev`, `backend-service-prod`, `frontend-service-dev`, `frontend-service-prod`.
> Full stable service names: `backend-service-dev-stable`, `frontend-service-prod-stable`, etc.

---

### Step 8 -- Trigger the CI Pipeline

```bash
# Touch backend source to trigger CI
echo "# trigger" >> app/backend-service/server.js

git add app/backend-service/server.js
git commit -m "feat: trigger CI pipeline demo"
git push origin main
```

**Automated pipeline flow:**

```
git push
  +-> GitHub Actions (ci-backend.yml)
        +- Docker build (multi-stage)
        +- Cosign sign (keyless OIDC -- no key files needed)
        +- docker push -> Docker Hub
        +- yq e '.image.tag = "abc1234"' helm/backend-service/values.yaml
              +- git commit -> git push -> main

ArgoCD detects values.yaml changed
  +-> Argo Rollouts starts canary (prod only; dev updates directly)
        +- setWeight: 10%   -> pause 2m
        +- AnalysisRun #1   -> Prometheus query (success_rate >= 0.95?)
        +- setWeight: 50%   -> pause 2m
        +- AnalysisRun #2   -> Prometheus query (success_rate >= 0.95?)
              +- PASS -> promote to 100%
              +- FAIL -> automatic rollback to stable (zero human action)
```

```bash
# Watch the canary progress in real-time
kubectl argo rollouts get rollout backend-service -n zero-drift-dev --watch
```

---

## Demo: Automatic Rollback on Failure

This is the centrepiece demonstration of ZeroDrift. A bad deployment is detected by Prometheus analysis and rolled back -- **without any human intervention**.

```bash
# 1. Inject a failure flag into the dev environment
#    Edit: helm/backend-service/values-dev.yaml
#    Change:   FORCE_ERRORS: "false"
#    To:       FORCE_ERRORS: "true"
#    This makes /api/efficiency return HTTP 500 on every request

git add helm/backend-service/values-dev.yaml
git commit -m "feat: simulate bad deployment (FORCE_ERRORS=true)"
git push origin main

# 2. Watch the rollout in a separate terminal
kubectl argo rollouts get rollout backend-service -n zero-drift-dev --watch
```

**What you will observe:**

```
Step 1: Canary starts at 10% traffic
Step 2: AnalysisRun fires -- queries Prometheus:
        sum(rate(http_requests_total{status!~"5..", ...}[5m]))
        / sum(rate(http_requests_total{...}[5m]))
        Result: 0.0  (all requests returning 500)
Step 3: successCondition "result[0] >= 0.95" -> FALSE
Step 4: failureLimit: 1 exceeded -> Analysis FAILED
Step 5: Rollout status: AbortedRollback
Step 6: Traffic: 100% reverts to previous stable version
Step 7: Zero downtime -- stable pods were never touched
```

```bash
# 3. Restore healthy state
git revert HEAD --no-edit
git push origin main
```

---

## Demo: GitOps Self-Healing

ArgoCD's `selfHeal: true` continuously reconciles live cluster state against Git. Any manual drift is automatically corrected.

```bash
# 1. Manually scale up the deployment (simulating an out-of-band change)
kubectl scale rollout backend-service -n zero-drift-dev --replicas=5

# 2. Watch ArgoCD detect and revert the drift (within ~3 minutes)
kubectl get rollout backend-service -n zero-drift-dev -w

# 3. Verify the revert via events
kubectl get events -n zero-drift-dev --sort-by='.lastTimestamp' | tail -20
```

**What happens:**
1. `kubectl scale` changes `spec.replicas` to 5 in the live cluster
2. ArgoCD detects drift: live state != Git state (`replicaCount: 1` in `values-dev.yaml`)
3. ArgoCD self-heals: rollout is reconciled back to 1 replica
4. Events log shows the scale-up event followed by the ArgoCD revert event

---

## Promote to Production

Production deployments are deliberately manual and every action is audited:

1. **GitHub -> Actions -> Promote to Production -> Run workflow**
2. Enter the image tag to promote (visible in CI logs, e.g. `a3f9d1c`)
3. The workflow:
   - Creates branch `promote-prod-<tag>`
   - Patches `helm/backend-service/values-prod.yaml` and `helm/frontend-service/values-prod.yaml`
   - Opens a PR against `main`
4. Review the PR -- verify both service prod values are updated
5. The `production` **Environment Gate** fires -- approve as the required reviewer
6. Merge the PR into `main`
7. In ArgoCD UI: click `backend-service-prod` -> **Sync**, then `frontend-service-prod` -> **Sync**

> `autoSync` is **disabled** for prod -- every sync is a deliberate, human-approved action with a full Git audit trail.

---

## Monitoring & SLOs

### Grafana Dashboards

Access Grafana at `http://localhost:3000` after port-forwarding (see Step 7).

| Dashboard | Key Panels |
|---|---|
| **Platform Overview** | Request rate (RPS), error rate (%), P95 latency (ms), active rollout phase, Kyverno violations |
| **SLO Error Budget** | 30-day availability burn rate, latency SLO burn rate, budget remaining (%) |

### Service Level Objectives

| SLO | Target | Window | Alert |
|---|---|---|---|
| **Availability** | >= 99.5% of requests return 2xx/3xx | 30 days | `ErrorBudgetBurnRate` -- error rate > 0.5% for 5m |
| **Latency** | P95 < 500ms | 30 days | `LatencySLOBreach` -- P95 > 500ms for 5m |
| **Rollout Health** | No rollouts in Degraded state | continuous | `RolloutDegraded` -- fires within 1m of degradation |

### Prometheus Metrics

Both services export custom metrics at `/metrics`:

| Metric | Type | Labels |
|---|---|---|
| `http_requests_total` | Counter | `app`, `method`, `status`, `rollouts_pod_template_hash` |
| `http_request_duration_seconds` | Histogram | `app`, `method`, `status`, `rollouts_pod_template_hash` |

The `rollouts_pod_template_hash` label is injected from pod metadata -- this lets `AnalysisTemplate` isolate canary traffic in Prometheus queries.

### Backend API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/efficiency` | GET | Returns namespace CPU/memory waste and cost savings (toggle with FORCE_ERRORS) |
| `/api/fail` | GET | Always returns HTTP 500 (intentional failure endpoint for demos) |
| `/api/slow` | GET | Returns after a 3-second delay (latency testing) |
| `/metrics` | GET | Prometheus metrics (prom-client default + custom counters/histograms) |
| `/healthz` | GET | Liveness probe -- returns 200 OK |
| `/readyz` | GET | Readiness probe -- returns 200 OK |

---

## Chaos Engineering

All experiments target `zero-drift-dev` namespace **only**. Production is never touched.

| Experiment | File | Schedule | What It Validates |
|---|---|---|---|
| **Pod Failure** | `chaos/pod-failure-dev.yaml` | Mon-Fri at 22:00 | K8s + ArgoCD restore the pod; SLO stays within budget |
| **Network Latency +300ms** | `chaos/network-latency-dev.yaml` | Wed at 22:30 | Latency SLO alert fires and auto-resolves when experiment ends |
| **CPU Stress 80%** | `chaos/cpu-stress-dev.yaml` | Thu at 23:00 | HPA scales replicas up under load |

```bash
# Manually trigger a chaos experiment
kubectl apply -f chaos/pod-failure-dev.yaml -n chaos-testing

# List all active experiments
kubectl get podchaos,networkchaos,stresschaos -n chaos-testing

# Pause an experiment
kubectl annotate podchaos backend-service-pod-failure \
  chaos-mesh.org/pause=true -n chaos-testing

# Delete an experiment
kubectl delete -f chaos/pod-failure-dev.yaml -n chaos-testing
```

---

## Security Model

| Control | Implementation | Enforcement Point |
|---|---|---|
| **Image Signing** | Cosign keyless via GitHub OIDC -- every CI build | Kyverno `verifyImages` -- unsigned images rejected at admission |
| **Registry Allowlist** | `require-trusted-registry` ClusterPolicy (Enforce) | Pods from unknown registries rejected before scheduling |
| **Resource Limits** | `require-resource-limits` ClusterPolicy (Enforce) | Pods without CPU/memory limits cannot be created |
| **Standard Labels** | `add-standard-labels` ClusterPolicy (Mutation) | `app` and `env` labels auto-injected on all pods |
| **Encrypted Secrets** | Grafana admin secret provisioned by Terraform | Plaintext credentials never appear in Git |
| **Network Isolation** | `NetworkPolicy` in each Helm chart | Backend reachable only from frontend and Prometheus |
| **Vulnerability Gate** | Trivy in CI with `--exit-code 1` on HIGH/CRITICAL (planned) | Build fails before push if vulnerable packages found |
| **Audit Trail** | Every prod deploy is a reviewed, merged PR | Full Git history of every production change, who approved, and when |

---

## Design Decisions (ADRs)

| ADR | Decision | Rationale |
|---|---|---|
| [ADR-001](docs/adr/ADR-001-argo-rollouts-vs-flagger.md) | **Argo Rollouts** over Flagger | Native ArgoCD integration; Prometheus AnalysisTemplate is more composable |
| [ADR-002](docs/adr/ADR-002-kyverno-vs-opa-gatekeeper.md) | **Kyverno** over OPA Gatekeeper | Native Kubernetes YAML; no Rego language required |
| [ADR-003](docs/adr/ADR-003-loki-vs-elasticsearch.md) | **Loki** over Elasticsearch | Cost-efficient; indexes only labels; integrates natively with Grafana |
| [ADR-004](docs/adr/ADR-004-sealed-secrets-vs-external-secrets.md) | **Terraform-provisioned secrets** | No external dependency required for local cluster bootstrap |
| [ADR-005](docs/adr/ADR-005-terraform-boundary.md) | **Terraform for bootstrap only** | Terraform owns CRD-level prerequisites; ArgoCD owns everything else |

---

## Operational Runbooks

| Runbook | Use When |
|---|---|
| [Rollback a Deployment](docs/runbook/rollback-a-deployment.md) | A promoted canary is causing production issues |
| [Promote to Production](docs/runbook/promote-to-prod.md) | Step-by-step manual prod promotion walkthrough |
| [Debug with Traces](docs/runbook/debug-with-traces.md) | Tracing a slow request from Grafana -> Tempo -> Loki |
| [Error Budget Response](docs/runbook/error-budget-response.md) | SLO burn rate alert fires |
| [Chaos Experiment Guide](docs/runbook/chaos-experiment-guide.md) | Running, pausing, or scheduling a Chaos Mesh experiment |

---

## Troubleshooting

<details>
<summary><strong>ArgoCD shows OutOfSync after terraform apply</strong></summary>

```bash
# Force a refresh and sync from CLI
kubectl -n argocd exec deploy/argocd-server -- \
  argocd app sync backend-service-dev --force --insecure --server localhost:8080
# Or use the ArgoCD UI: click Refresh then Sync
```
</details>

<details>
<summary><strong>terraform apply fails -- Kyverno rejecting resources</strong></summary>

```bash
# Check which policy is blocking
kubectl get policyreport -A

# Temporarily switch to Audit mode to unblock bootstrap
kubectl patch clusterpolicy require-resource-limits \
  --type=merge -p '{"spec":{"validationFailureAction":"Audit"}}'

# Re-run terraform apply, then restore Enforce mode
kubectl patch clusterpolicy require-resource-limits \
  --type=merge -p '{"spec":{"validationFailureAction":"Enforce"}}'
```
</details>

<details>
<summary><strong>Argo Rollout stuck -- AnalysisRun Inconclusive</strong></summary>

```bash
kubectl get analysisrun -n zero-drift-dev
kubectl describe analysisrun <NAME> -n zero-drift-dev
```

**Cause:** Prometheus has no data yet -- no traffic is hitting the canary pod.  
**Fix:** Generate load (`curl http://localhost:3001/api/efficiency` in a loop), or wait 3 minutes for baseline metrics, then retry.
</details>

<details>
<summary><strong>ServiceMonitor not picked up by Prometheus</strong></summary>

```bash
kubectl get servicemonitor -n zero-drift-dev
kubectl get prometheus -n monitoring -o yaml | grep -A5 serviceMonitorSelector
```

**Cause:** The `ServiceMonitor` must carry the label `release: kube-prometheus-stack`.  
**Fix:** Verify `helm/backend-service/templates/servicemonitor.yaml` has this label in its `metadata.labels`.
</details>

<details>
<summary><strong>Port-forwarding to stable service returns connection refused</strong></summary>

```bash
# List all services and endpoints
kubectl get svc -n zero-drift-dev
kubectl get endpoints -n zero-drift-dev

# Verify the rollout has at least one ready pod
kubectl argo rollouts get rollout backend-service -n zero-drift-dev
```

**Note:** Services follow the pattern `{helm-release-name}-stable`. Helm release names include the environment suffix.  
Example stable services: `backend-service-dev-stable`, `frontend-service-prod-stable`.
</details>

<details>
<summary><strong>Frontend shows error fetching /api/efficiency</strong></summary>

The frontend proxies `/api/*` to `BACKEND_URL` (default: `http://backend-service-stable`).
When port-forwarding to the frontend, the proxy resolves this URL from inside the cluster -- this is expected.

```bash
# Test the backend directly to verify it is healthy
kubectl port-forward svc/backend-service-dev-stable -n zero-drift-dev 3001:80
curl http://localhost:3001/api/efficiency
```
</details>

---

## Contributing

1. Fork this repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit with [Conventional Commits](https://www.conventionalcommits.org/): `git commit -m "feat: describe your change"`
4. Push and open a pull request against `main`
5. CI runs automatically -- all checks must pass before merge

---

## License

[MIT](https://opensource.org/licenses/MIT) (C) [Vanshaj Agarwal](https://github.com/Codervanshaj)

---

<div align="center">

**Built end-to-end as a demonstration of production-grade DevOps engineering.**

*GitOps · Progressive Delivery · Policy-as-Code · Full Observability · Chaos Engineering*

</div>
