# ZeroDrift — Production GitOps Platform
### Complete Project Redesign Roadmap (Updated for Kube-Optima)

---

## What This Project Becomes

Right now this project answers one question: *"Can we prevent manual changes from persisting in a cluster?"*

That is one feature of ArgoCD, not a project.

A real project answers a real operational problem that teams face in production:

> **"How do we ship code to production multiple times a day with zero downtime, automatic rollback on failure, full observability across logs/metrics/traces, enforced compliance policies, and a GitOps workflow that works even under failure conditions — all on infrastructure that bootstraps itself from scratch?"**

That is what this project becomes.

---

## Final Architecture (Target State)

```
                          ┌──────────────────────────────────┐
                          │         Git Repository            │
                          │  (single source of truth)        │
                          └───────────────┬──────────────────┘
                                          │
              ┌───────────────────────────▼─────────────────────────┐
              │                  GitHub Actions CI                   │
              │  lint → test → trivy scan → build → sign → push    │
              │           └──► update values.yaml (yq)              │
              └───────────────────────────┬─────────────────────────┘
                                          │ Git commit
              ┌───────────────────────────▼─────────────────────────┐
              │                    ArgoCD                            │
              │   AppProject → ApplicationSet → Apps (dev + prod)   │
              │   selfHeal=true    prune=true    syncWaves           │
              └──────┬──────────────┬─────────────────┬─────────────┘
                     │              │                  │
              ┌──────▼──────┐ ┌────▼────────┐  ┌──────▼──────────┐
              │  API Service │ │  Worker Svc │  │  Infra Apps     │
              │ Argo Rollout │ │  Argo       │  │  - Prometheus   │
              │ (canary)     │ │  Rollout    │  │  - Grafana      │
              └──────┬───────┘ └────┬────────┘  │  - Loki        │
                     │              │            │  - Tempo        │
              ┌──────▼──────────────▼──────────┐ │  - Kyverno     │
              │     nginx Ingress Controller    │ │  - Chaos Mesh  │
              └─────────────────────────────────┘ └───────────────┘
              
              Policy layer (Kyverno): validates every resource before admission
              Observability: Prometheus (metrics) + Loki (logs) + Tempo (traces)
              Chaos: Chaos Mesh runs scheduled experiments, SLO alerts fire+resolve
```

---

## What Changes, What Stays, What Is Added

| Layer | Current State | Target State | Action |
|---|---|---|---|
| App | 20-line JSON ping | 2-service system with real endpoints, Prometheus metrics, OpenTelemetry traces, structured logs | **Rewrite** |
| Dockerfile | Two-stage, non-root ✅ | Same + build args for git SHA + multi-arch | **Enhance** |
| CI | Build → push → `sed` patch | lint → trivy → build → cosign sign → push → `yq` patch → multi-service fan-out | **Rewrite** |
| Helm | Deployment + Service | Argo Rollout + Service + Ingress + HPA + PDB + NetworkPolicy + ServiceMonitor | **Expand** |
| ArgoCD | Single Application | AppProject + ApplicationSet + sync waves + notifications | **Rewrite** |
| Terraform | ArgoCD only, tfstate in git | Modular bootstrap: ArgoCD + Argo Rollouts + Kyverno + Sealed Secrets + Chaos Mesh | **Rewrite** |
| Observability | None | Prometheus + Loki + Tempo + Grafana with unified dashboards + SLO error budgets | **New** |
| Progressive Delivery | None | Argo Rollouts canary with Prometheus AnalysisTemplate | **New** |
| Policy | None | Kyverno ClusterPolicies (validation + mutation) | **New** |
| Chaos Engineering | None | Chaos Mesh scheduled experiments + SLO-correlated alerts | **New** |
| Secret Management | None | Sealed Secrets (kubeseal) | **New** |
| Security | Non-root user only | Cosign image signing + Trivy gate + RBAC + NetworkPolicy | **Enhance** |

---

## Phase 0 — Fix Technical Debt (Blocking — Do This First)
**Time: 1 day**

Non-negotiable. These are not improvements — they are correctness issues.

### 0.1 — Remove `terraform.tfstate` from git history permanently
```bash
# Install git-filter-repo (pip install git-filter-repo)
git filter-repo --path terraform/terraform.tfstate --invert-paths --force
git filter-repo --path terraform/terraform.tfstate.backup --invert-paths --force
git filter-repo --path terraform/.terraform/ --invert-paths --force
```
Update `.gitignore` to prevent this from ever happening again:
```gitignore
# Terraform
**/.terraform/
*.tfstate
*.tfstate.*
*.tfvars
*.tfvars.json
override.tf
override.tf.json
```

### 0.2 — Add Terraform Cloud remote backend
```hcl
# terraform/backend.tf
terraform {
  cloud {
    organization = "your-org"
    workspaces {
      name = "zero-drift-local"
    }
  }
}
```
Free tier. Stores state remotely. Enables state locking.

### 0.3 — Replace `sed` with `yq` in CI
```yaml
- name: Update image tag in Helm values
  run: |
    yq e '.image.tag = strenv(TAG)' -i helm/backend-service/values.yaml
    # Verify the write succeeded (fails if file is malformed)
    test "$(yq e '.image.tag' helm/backend-service/values.yaml)" = "$TAG"
```

### 0.4 — Replace `null_resource local-exec` with `kubernetes_manifest`
```hcl
resource "kubernetes_manifest" "argocd_app_project" {
  manifest   = yamldecode(file("${path.module}/../argocd/project.yaml"))
  depends_on = [time_sleep.wait_for_argocd_crd]
}
```
Terraform now tracks the AppProject in state — it can detect and repair drift on the bootstrapper itself.

---

## Phase 1 — Real Application (Two-Tier Kubernetes Efficiency Dashboard)
**Time: 3–4 days**

> The app is the vehicle through which every DevOps concept is demonstrated.
> It needs to be real and serve a unique, useful purpose.
> It will be: **Kube-Optima (Kubernetes Pod Efficiency Analyser)**, a dashboard that monitors pod resource limits vs actual utilization and highlights cost waste.

### What the app becomes: a **Kubernetes Resource & Cost Optimization Tool**

Two services that form a modern 2-tier application:

**Service 1: `frontend-service`** (Node.js/React or Vanilla JS + Express)
- The public-facing service. Serves a beautiful dashboard (dark mode, graphs of resource usage).
- Acts as a reverse proxy for all API requests (forwarding `/api/*` to the `backend-service`).
- Routes:
  - `GET /` — serves the dashboard UI
  - `GET /healthz` — liveness probe
  - `GET /readyz` — readiness probe
  - `GET /metrics` — Prometheus-format metrics for the frontend proxy
  - Traces client requests to the backend (injecting `traceparent` header for OTel distributed tracing)

**Service 2: `backend-service`** (Node.js/Express or Python/FastAPI)
- Background/Internal API service. No public ingress.
- Connects to the local Kubernetes API or reads simulated cluster usage data if running locally/offline.
- Computes efficiency metrics: `efficiency_score = (Max CPU/Mem Used) / (CPU/Mem Limit)`.
- Calculates simulated monthly USD savings based on wasted CPU/Memory.
- Routes (internal only):
  - `GET /api/efficiency` — returns JSON array of namespaces and their resource waste/cost savings.
  - `GET /healthz` / `GET /readyz`
  - `GET /metrics` — Prometheus metrics (custom metrics: `k8s_waste_cpu_cores`, `k8s_waste_memory_bytes`, `k8s_potential_savings_usd`)
  - `GET /api/fail` — intentionally returns 500 (used for canary analysis and rollback)
  - `GET /api/slow` — intentionally delays response by 3 seconds (used for latency SLO alerts)

**Why this setup:**
- Justifies separate Helm charts, separate Rollouts, and separate CI jobs.
- Creates a real pod-to-pod network path: `Ingress -> frontend-service -> backend-service` (ideal for demonstrating NetworkPolicies).
- The `backend-service` resource utilization or request rate drives Horizontal Pod Autoscaling (HPA).
- Distributed tracing (OTel) is demonstrated as requests flow from Ingress -> frontend-service proxy -> backend-service.

### 1.1 — Git identity injected at build time
```dockerfile
ARG GIT_COMMIT=unknown
ARG BUILD_TIME=unknown
ARG SERVICE_NAME=backend-service
LABEL org.opencontainers.image.revision=$GIT_COMMIT
LABEL org.opencontainers.image.created=$BUILD_TIME
ENV GIT_COMMIT=$GIT_COMMIT BUILD_TIME=$BUILD_TIME SERVICE_NAME=$SERVICE_NAME
```
The API response includes `"commit": "a3f9d1c"` — you can observe drift correction by watching the commit SHA revert after a manual image change.

### 1.2 — OpenTelemetry instrumentation from day one
- Install `@opentelemetry/sdk-node` (or equivalent) in both services
- Auto-instrument HTTP routes and downstream fetches
- Export traces to **Tempo** via OTLP (configured via env var — no code change when switching backends)
- The frontend-service proxy propagates the `traceparent` header to the backend-service

### 1.3 — Structured JSON logging
Replace standard console logs with a structured logger (`pino` in Node.js):
```json
{"level":"info","time":1736935380,"service":"backend-service","commit":"a3f9d1c","traceId":"abc123","msg":"GET /api/efficiency 200 45ms"}
```
Loki scrapes these logs. Grafana links logs → traces via `traceId`.

---

## Phase 2 — Progressive Delivery with Argo Rollouts
**Time: 4–5 days | The crown jewel of this project**

> This is the single feature that separates this project from every other "GitOps portfolio project."
> Argo Rollouts with automated analysis is genuinely hard to implement correctly
> and is used by production engineering teams at real companies.

### Why this is hard
You're not just changing `Deployment` → `Rollout`. You need to:
1. Understand traffic splitting (Rollout needs an ingress controller to split traffic — nginx annotations)
2. Write an `AnalysisTemplate` that queries Prometheus and makes a real go/no-go decision
3. Handle the bootstrap problem (Argo Rollouts CRD must exist before `Rollout` resources)
4. Understand the difference between canary steps and analysis runs
5. Handle edge cases: what if Prometheus is unavailable during analysis?

### 2.1 — Replace `Deployment` with `Rollout` in Helm chart

```yaml
# helm/backend-service/templates/rollout.yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: {{ .Release.Name }}
spec:
  replicas: {{ .Values.replicaCount }}
  strategy:
    canary:
      canaryService: {{ .Release.Name }}-canary   # routes canary traffic
      stableService: {{ .Release.Name }}-stable    # routes stable traffic
      trafficRouting:
        nginx:
          stableIngress: {{ .Release.Name }}-stable
      steps:
        - setWeight: 10      # send 10% traffic to new version
        - pause: {duration: 2m}
        - analysis:
            templates:
              - templateName: success-rate-check
        - setWeight: 50      # if analysis passed: 50% traffic
        - pause: {duration: 2m}
        - analysis:
            templates:
              - templateName: success-rate-check
        # If all analysis passes: promote to 100% (automatic)
```

### 2.2 — AnalysisTemplate that uses YOUR app's Prometheus metrics

```yaml
# helm/backend-service/templates/analysis-template.yaml
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: success-rate-check
spec:
  metrics:
    - name: success-rate
      interval: 60s
      count: 3              # run 3 times
      successCondition: result[0] >= 0.95   # 95%+ success rate required
      failureLimit: 1       # fail immediately if any check fails
      provider:
        prometheus:
          address: http://prometheus-server.monitoring:9090
          query: |
            sum(rate(http_requests_total{
              service="backend-service",
              status!~"5..",
              version="{{ args.canary-hash }}"
            }[5m]))
            /
            sum(rate(http_requests_total{
              service="backend-service",
              version="{{ args.canary-hash }}"
            }[5m]))
```

**What this does in practice:**
- CI pushes a new image → ArgoCD syncs → Rollout starts canary with 10% traffic
- Prometheus measures: is the new version's success rate ≥ 95% over 5 minutes?
- If yes: promote to 50%, check again, promote to 100%
- If no: **automatic rollback** — no human intervention needed
- All of this is git-driven — you changed `values.yaml`, the pipeline decided if it's safe

### 2.3 — Demo-able failure scenario
Change your `backend-service` to read an env var:
```javascript
app.get('/api/efficiency', (req, res) => {
  if (process.env.FORCE_ERRORS === 'true') {
    res.status(500).json({ error: 'simulated failure' });
    return;
  }
  // normal handling
});
```
Set `FORCE_ERRORS=true` in `values-dev.yaml` for a canary version → watch Prometheus catch it → watch Rollout auto-abort → ArgoCD reverts to stable. **This is the demo.**

---

## Phase 3 — Multi-Environment GitOps with Real Promotion Gates
**Time: 3–4 days**

### 3.1 — Helm chart structure for two real environments

```
helm/
├── backend-service/
│   ├── Chart.yaml
│   ├── values.yaml            # base: image tag, probes, metrics
│   ├── values-dev.yaml        # replicaCount: 1, canary: disabled, ingress: dev.local
│   └── values-prod.yaml       # replicaCount: 3, canary: enabled, PDB: true, HPA: true
└── frontend-service/
    ├── Chart.yaml
    ├── values.yaml
    ├── values-dev.yaml
    └── values-prod.yaml
```

### 3.2 — ArgoCD AppProject with real RBAC
```yaml
# argocd/project.yaml
spec:
  sourceRepos:
    - "https://github.com/Codervanshaj/ZeroDrift-K8-Pipeline.git"
    - "https://prometheus-community.github.io/helm-charts"   # allow infra charts
    - "https://argoproj.github.io/argo-helm"
  destinations:
    - namespace: "zero-drift-*"    # wildcard — covers dev and prod
      server: https://kubernetes.default.svc
    - namespace: monitoring
      server: https://kubernetes.default.svc
  clusterResourceWhitelist:
    - group: ""
      kind: Namespace
    - group: "monitoring.coreos.com"
      kind: "*"
  roles:
    - name: readonly
      policies:
        - p, proj:zero-drift:readonly, applications, get, zero-drift/*, allow
```

### 3.3 — ApplicationSet covering both services, both environments

```yaml
# argocd/applicationset.yaml
generators:
  - matrix:
      generators:
        - list:
            elements:
              - service: backend-service
                port: "3000"
              - service: frontend-service
                port: "8080"
        - list:
            elements:
              - env: dev
                namespace: zero-drift-dev
                autoSync: "true"
                valuesFile: values-dev.yaml
              - env: prod
                namespace: zero-drift-prod
                autoSync: "false"
                valuesFile: values-prod.yaml
```
This generates 4 Applications from one config: `api-dev`, `api-prod`, `worker-dev`, `worker-prod`. Change the matrix and all 4 update.

### 3.4 — Prod promotion via PR + GitHub Environment gate
- CI auto-deploys both services to dev by patching `values.yaml`
- A separate `promote-prod.yml` workflow is triggered by a `workflow_dispatch` with input: `image-tag`
- It opens a PR updating `values-prod.yaml` for both services
- The PR requires a GitHub Environment `production` approval (configured in repo settings)
- On merge, ArgoCD syncs prod (manual sync since `autoSync: false`)
- **This creates a real promotion audit trail** — every prod deployment is a reviewed, approved PR

---

## Phase 4 — Policy Enforcement with Kyverno
**Time: 2–3 days | Almost no one implements this in portfolio projects**

> Kyverno is a Kubernetes admission controller. It sits in front of the API server and validates or mutates every resource before it's created. This is how real organizations enforce compliance.

### Why this is genuinely hard
- Kyverno must be installed BEFORE apps — bootstrap ordering problem
- Policies can block ArgoCD's own internal resources if you're not careful (requires exclusions)
- Writing policies that are useful but don't break legitimate operations requires real understanding

### 4.1 — ClusterPolicies that enforce your own standards

**Policy 1: Block images without a specific registry (prevents `latest` from untrusted sources)**
```yaml
# policies/require-trusted-registry.yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-trusted-registry
spec:
  validationFailureAction: Enforce
  background: false
  rules:
    - name: check-registry
      match:
        any:
          - resources:
              kinds: [Pod]
              namespaces: ["zero-drift-*"]
      validate:
        message: "Images must come from docker.io/vanshajagarwal/ or ghcr.io"
        pattern:
          spec:
            containers:
              - image: "docker.io/vanshajagarwal/*| ghcr.io/codervanshaj/*"
```

**Policy 2: Require resource limits on all containers**
```yaml
# policies/require-resource-limits.yaml
rules:
  - name: check-resource-limits
    validate:
      message: "Resource limits (cpu, memory) are required on all containers"
      pattern:
        spec:
          containers:
            - resources:
                limits:
                  cpu: "?*"
                  memory: "?*"
```

**Policy 3: Mutation — auto-inject standard labels**
```yaml
# policies/add-standard-labels.yaml
# Mutation policy: if a Deployment doesn't have these labels, add them automatically
rules:
  - name: add-labels
    mutate:
      patchStrategicMerge:
        metadata:
          labels:
            managed-by: argocd
            project: zero-drift
```

**Policy 4: Verify Cosign image signatures**
```yaml
# policies/verify-image-signature.yaml
rules:
  - name: verify-signature
    verifyImages:
      - imageReferences: ["docker.io/vanshajagarwal/backend-service*"]
        attestors:
          - count: 1
            entries:
              - keyless:
                  subject: "https://github.com/Codervanshaj/ZeroDrift-K8-Pipeline/.github/workflows/ci.yml@refs/heads/main"
                  issuer: "https://token.actions.githubusercontent.com"
```
This policy rejects any image that wasn't signed by YOUR GitHub Actions workflow. Zero manual key management — uses GitHub OIDC.

### 4.2 — Kyverno Policy Reports
Kyverno generates `PolicyReport` CRDs automatically. Add a Grafana panel querying:
```promql
kyverno_policy_results_total{rule_type="validation", status="fail"}
```
If this is non-zero, something tried to violate policy and was blocked. **Your cluster state is provably compliant.**

---

## Phase 5 — Full Observability: Metrics + Logs + Traces
**Time: 4–5 days | The "three pillars" done properly**

> Most portfolio projects have "Prometheus and Grafana." This means metrics only.
> Real observability means you can debug any incident using metrics, logs, OR traces — and correlate between them.

### 5.1 — Stack deployed via ArgoCD (dogfood the pipeline)

```
argocd/
├── infra/
│   ├── monitoring-stack.yaml     # ArgoCD App for kube-prometheus-stack
│   ├── loki-stack.yaml           # ArgoCD App for Grafana Loki
│   ├── tempo.yaml                # ArgoCD App for Grafana Tempo
│   └── kyverno.yaml              # ArgoCD App for Kyverno
```

Every infrastructure component is deployed via the same GitOps pipeline as the application. If someone manually changes a Prometheus scrape config, ArgoCD reverts it. **The observability stack itself is zero-drift.**

### 5.2 — ServiceMonitor for each service (not the default scrape job)
```yaml
# helm/backend-service/templates/servicemonitor.yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: {{ .Release.Name }}
  labels:
    release: kube-prometheus-stack   # must match Prometheus operator's selector
spec:
  selector:
    matchLabels:
      app: {{ .Release.Name }}
  endpoints:
    - port: http
      path: /metrics
      interval: 15s
```

### 5.3 — Loki for structured log aggregation
- Deploy Loki + Promtail via ArgoCD
- Promtail's `DaemonSet` ships pod logs from `/var/log/pods/` to Loki
- Since your app logs structured JSON, Loki's LogQL can filter: `{namespace="zero-drift-prod"} | json | level = "error"`
- Grafana Explore: search logs by `traceId` — click a trace in Tempo, jump to logs for that exact request

### 5.4 — Tempo for distributed tracing
- Deploy Tempo (Grafana's tracing backend) via ArgoCD
- Configure OTLP receiver in Tempo
- App services send traces via OTLP exporter to `http://tempo.monitoring:4318/v1/traces`
- **Grafana data source:** add Tempo, configure `traceToLogs` link pointing at Loki
- Now in Grafana: click a slow API trace → see the worker service span → jump to logs for that trace ID

### 5.5 — Grafana dashboards as code (not clicked together in the UI)

**Dashboard 1: Platform Overview**

| Panel | Query | What it shows |
|---|---|---|
| Request Rate | `rate(http_requests_total{namespace="zero-drift-prod"}[5m])` | RPS per service |
| Error Rate | `rate(http_requests_total{status=~"5.."}[5m])` | Production errors |
| P95 Latency | `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))` | Tail latency |
| Active Rollouts | `argocd_rollout_info{phase!="Healthy"}` | Canaries in progress |
| Policy Violations | `kyverno_policy_results_total{status="fail"}` | Compliance |
| Drift Events | `increase(argocd_app_sync_total{phase="Succeeded"}[1h])` | How many self-heals happened |

**Dashboard 2: SLO Error Budget**

Define two SLOs:
- **Availability SLO**: 99.5% of requests over a 30-day window return 2xx or 3xx
- **Latency SLO**: 95% of requests complete in < 500ms

```promql
# Error budget remaining (%)
(1 - 
  (1 - 0.995) -
  (sum(increase(http_requests_total{status=~"5.."}[30d])) /
   sum(increase(http_requests_total[30d])))
) * 100
```

This panel shows a number. If it goes below 0, you've burned your error budget — that's a meaningful alert. **You're doing SRE work, not just DevOps.**

### 5.6 — Alert rules that map to real incidents

```yaml
# monitoring/alert-rules.yaml
groups:
  - name: backend-service-slo
    rules:
      - alert: ErrorBudgetBurnRate
        expr: |
          sum(rate(http_requests_total{status=~"5..", service="backend-service"}[1h]))
          /
          sum(rate(http_requests_total{service="backend-service"}[1h])) > 0.005
        for: 5m
        labels:
          severity: warning
          slo: availability
        annotations:
          summary: "Error budget burn rate exceeds 0.5% — SLO at risk"
          runbook: "https://github.com/Codervanshaj/ZeroDrift-K8-Pipeline/docs/runbook.md#error-budget-burn"

      - alert: RolloutDegraded
        expr: argocd_rollout_info{phase="Degraded"} == 1
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Argo Rollout degraded — canary likely failed analysis"
```

---

## Phase 6 — Chaos Engineering
**Time: 2–3 days | Proves your system is actually resilient, not just tested**

> Chaos engineering is not about breaking things randomly. It's about running controlled experiments to verify that your system behaves correctly under failure conditions — BEFORE those failures happen in production.

### 6.1 — Chaos Mesh deployed via ArgoCD
```yaml
# argocd/infra/chaos-mesh.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: chaos-mesh
  namespace: argocd
spec:
  source:
    repoURL: https://charts.chaos-mesh.org
    chart: chaos-mesh
    targetRevision: ">=2.6.0"
  destination:
    namespace: chaos-testing
```

### 6.2 — Three concrete chaos experiments (committed to Git)

**Experiment 1: Pod failure (does zero-drift restore it?)**
```yaml
# chaos/pod-failure-dev.yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: PodChaos
metadata:
  name: backend-service-pod-failure
  namespace: chaos-testing
spec:
  action: pod-kill
  mode: one
  duration: "30s"
  selector:
    namespaces: [zero-drift-dev]
    labelSelectors:
      app: backend-service
  scheduler:
    cron: "0 22 * * 1-5"    # every weeknight at 10pm
```
After the pod is killed, K8s + ArgoCD restore it. Prometheus records the downtime window. The SLO dashboard shows the impact. **This is a controlled proof of resilience.**

**Experiment 2: Network latency (does the latency SLO alert fire?)**
```yaml
# chaos/network-latency-dev.yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: NetworkChaos
metadata:
  name: frontend-to-backend-latency
spec:
  action: delay
  mode: all
  duration: "5m"
  selector:
    namespaces: [zero-drift-dev]
    labelSelectors:
      app: frontend-service
  delay:
    latency: "300ms"    # adds 300ms to frontend → backend calls
  scheduler:
    cron: "30 22 * * 3"    # every Wednesday night
```
300ms of extra latency → P95 latency crosses 500ms threshold → `LatencySLOBreach` alert fires → you watch it resolve after 5 minutes.

**Experiment 3: CPU stress (does HPA scale out?)**
```yaml
# chaos/cpu-stress-dev.yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: StressChaos
metadata:
  name: backend-cpu-stress
spec:
  mode: all
  duration: "10m"
  selector:
    namespaces: [zero-drift-dev]
    labelSelectors:
      app: backend-service
  stressors:
    cpu:
      workers: 2
      load: 80
  scheduler:
    cron: "0 23 * * 4"    # every Thursday night
```
Backend pods hit CPU limit → HPA scales from 1 to 3 replicas → Grafana shows the scale-out event → CPU per pod drops.

### 6.3 — Chaos Report (what you show in the README)
After a few weeks of running, you'll have real data: "Over 30 days, 15 chaos experiments ran. System stayed within SLO for 13/15. 2 experiments triggered the canary rollback mechanism. Zero manual interventions required."

**That sentence on a GitHub README is worth more than 10 badges.**

---

## Phase 7 — Security Hardening
**Time: 2–3 days**

### 7.1 — Cosign image signing (keyless, GitHub OIDC)
```yaml
# In ci.yml, after build-and-push:
- name: Sign image with Cosign
  uses: sigstore/cosign-installer@v3
  
- name: Sign the container image
  env:
    COSIGN_EXPERIMENTAL: "1"
  run: |
    cosign sign --yes \
      ${{ env.IMAGE_NAME }}:${{ steps.vars.outputs.TAG }}@${{ steps.build.outputs.digest }}
```
No keys to manage. The signature is stored in the OCI registry alongside the image. Kyverno's `verifyImages` policy (Phase 4) validates it on admission.

### 7.2 — Sealed Secrets for everything sensitive
```
secrets/
├── grafana-admin-sealed.yaml       # Grafana admin password
├── argocd-notifications-sealed.yaml # Slack webhook for ArgoCD notifications
└── README.md                        # Instructions for sealing new secrets
```
Zero plaintext secrets in Git. **This answers the #1 GitOps interview question correctly.**

### 7.3 — NetworkPolicy matrix (who talks to whom)

| Source | Destination | Allowed |
|---|---|---|
| nginx-ingress | frontend-service | ✅ |
| frontend-service | backend-service | ✅ |
| prometheus | backend-service:metrics | ✅ |
| prometheus | frontend-service:metrics | ✅ |
| anything else | backend-service | ❌ |
| anything else | frontend-service | ❌ |
| frontend-service | internet | ❌ |

Every NetworkPolicy lives in the Helm chart. If someone manually deletes one, ArgoCD restores it within 3 minutes. **Security posture is also zero-drift.**

---

## Phase 8 — Terraform: Bootstrap Everything from Zero
**Time: 2–3 days**

### 8.1 — What Terraform owns (and ONLY this)
Everything bootstrapped by Terraform is a **prerequisite for GitOps** — things ArgoCD cannot manage itself because they must exist before ArgoCD or the admission controller is running.

```
terraform/
├── backend.tf
├── main.tf                    # Calls modules in dependency order
├── variables.tf
├── outputs.tf
└── modules/
    ├── argocd/                # namespace + helm_release + AppProject + ApplicationSet
    ├── argo-rollouts/         # namespace + helm_release (CRDs must exist before Rollout resources)
    ├── kyverno/               # namespace + helm_release + initial ClusterPolicies
    └── sealed-secrets/        # namespace + helm_release (controller must exist before SealedSecrets)
```

### 8.2 — Dependency ordering (the hard part Terraform requires understanding of)
```
sealed-secrets controller
        ↓
      argocd
        ↓
   argo-rollouts
        ↓
     kyverno
        ↓
   argocd AppProject
        ↓
   argocd ApplicationSet  ← this triggers ArgoCD to manage everything else
```
Getting this right requires understanding Terraform `depends_on`, `time_sleep` for CRD registration, and the difference between `helm_release` completion and CRD availability. This is not trivial.

### 8.3 — What happens after `terraform apply` (the measure of a good bootstrap)
1. `terraform apply` completes (~10 minutes)
2. ArgoCD is running and has the ApplicationSet registered
3. ArgoCD begins syncing: monitoring stack, chaos mesh, backend-service (dev), frontend-service (dev)
4. All Kyverno policies are active — any non-compliant resource is rejected
5. Grafana is accessible with the admin password from a Sealed Secret

**A developer with kubectl access and the repo URL can run `terraform apply` and have a fully functional, observable, policy-enforced GitOps platform in 10 minutes. That is what good bootstrapping looks like.**

---

## Phase 9 — Documentation That Is Part of the Project
**Time: 2–3 days**

### 9.1 — Architecture diagram (draw it yourself — Excalidraw)
Must show: CI flow, ArgoCD sync loop, Rollout canary analysis loop, Kyverno admission path, Prometheus scrape path, Loki log ingestion, Tempo trace path, Chaos experiment targeting.

If you can draw it accurately, you understand it. Save as `docs/architecture.svg`.

### 9.2 — ADRs (Architecture Decision Records)
```
docs/adr/
├── ADR-001-argo-rollouts-vs-flagger.md
├── ADR-002-kyverno-vs-opa-gatekeeper.md
├── ADR-003-loki-vs-elasticsearch.md
├── ADR-004-sealed-secrets-vs-external-secrets.md
└── ADR-005-terraform-boundary.md
```
Each ADR has: **Context** (why this decision was needed), **Options considered**, **Decision**, **Consequences**. This is what senior engineers write. It proves you evaluated alternatives, not just installed the first thing you found.

### 9.3 — Runbooks (real operational procedures)
```
docs/runbook/
├── rollback-a-deployment.md      # How to manually abort a canary and revert
├── promote-to-prod.md            # Step-by-step prod promotion workflow
├── debug-with-traces.md          # How to find a slow request in Tempo from Grafana
├── error-budget-response.md      # What to do when the SLO error budget is burning fast
└── chaos-experiment-guide.md     # How to run or disable a chaos experiment
```

### 9.4 — README as a project story
Structure:
1. **The Problem** — Configuration drift, manual hotfixes, "works on staging" failures, deployment fear
2. **Architecture diagram** (embedded SVG)
3. **Key capabilities** — Progressive delivery, policy enforcement, full observability, chaos validation
4. **The demo** — Embedded GIF of a canary being auto-aborted due to high error rate
5. **SLO dashboard screenshot** — shows real 30-day error budget data
6. **Setup** — `terraform apply` and you're done (with prerequisites listed)
7. **Design decisions** — links to ADRs
8. Badges: CI status, ArgoCD sync, Rollout status, Kyverno policy status

---

## Project Repository Structure (Final)

```
ZeroDrift-K8-Pipeline/
├── .github/workflows/
│   ├── ci-backend.yml           # CI for backend-service
│   ├── ci-frontend.yml          # CI for frontend-service
│   └── promote-prod.yml         # Manual prod promotion workflow
├── app/
│   ├── backend-service/         # Node.js/Python API service
│   └── frontend-service/        # Node.js/React frontend service
├── helm/
│   ├── backend-service/         # Rollout + Service + Ingress + HPA + PDB + NetworkPolicy + ServiceMonitor
│   └── frontend-service/        # Rollout + Service + HPA + NetworkPolicy + ServiceMonitor
├── argocd/
│   ├── project.yaml             # AppProject with RBAC
│   ├── applicationset.yaml      # Matrix generator: 2 services × 2 envs
│   └── infra/
│       ├── monitoring-stack.yaml
│       ├── loki-stack.yaml
│       ├── tempo.yaml
│       ├── kyverno.yaml
│       └── chaos-mesh.yaml
├── terraform/
│   ├── backend.tf
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   └── modules/
│       ├── argocd/
│       ├── argo-rollouts/
│       ├── kyverno/
│       └── sealed-secrets/
├── policies/                    # Kyverno ClusterPolicies
│   ├── require-trusted-registry.yaml
│   ├── require-resource-limits.yaml
│   ├── add-standard-labels.yaml
│   └── verify-image-signature.yaml
├── monitoring/
│   ├── dashboards/
│   │   ├── platform-overview.json
│   │   └── slo-error-budget.json
│   └── alert-rules.yaml
├── chaos/
│   ├── pod-failure-dev.yaml
│   ├── network-latency-dev.yaml
│   └── cpu-stress-dev.yaml
├── secrets/
│   ├── grafana-admin-sealed.yaml
│   └── README.md
├── scripts/
│   ├── demo-canary-abort.sh     # Shows Rollout auto-aborting on bad metrics
│   └── demo-drift.sh            # Shows ArgoCD self-healing
└── docs/
    ├── architecture.svg
    ├── adr/
    └── runbook/
```

---

## What Makes This Non-Replicable Without Understanding

A recruiter or senior engineer reading this project would need to know:

| Concept | Why it's here |
|---|---|
| Argo Rollouts `AnalysisTemplate` with Prometheus queries | The canary analysis is not trivial — requires understanding of metric correctness and race conditions |
| Kyverno `verifyImages` with OIDC attestors | Image signing verification without a key management system |
| OpenTelemetry auto-instrumentation + OTLP export | Understanding of the OTEL SDK, exporter configuration, and trace propagation |
| Grafana `traceToLogs` correlation | Requires understanding of both Tempo and Loki data source configuration |
| SLO error budget math in PromQL | Requires understanding of multi-window burn rate calculations |
| Terraform bootstrap ordering with CRD registration timing | Understanding of `depends_on`, `time_sleep`, and Kubernetes CRD availability |
| ApplicationSet Matrix generator | Requires understanding of how generators compose and what they generate |
| Kyverno exclusions for ArgoCD system namespaces | Without this, Kyverno breaks ArgoCD — requires knowing how both systems work |
| Chaos Mesh experiment scheduling and SLO correlation | Understanding of how chaos manifests correlate to Prometheus metrics |
| Sealed Secrets rotation without cluster access | Understanding of the controller's public key and re-encryption |

**An AI cannot generate this in one prompt because many of these pieces have implicit dependencies on each other that require iterative debugging, cluster-specific tuning, and operational understanding to get right.**

---

## Timeline (Realistic)

| Phase | Work | Time |
|---|---|---|
| 0 — Tech debt | Fix tfstate, null_resource, sed | 1 day |
| 1 — Real app | Two services, OTel, structured logs | 3–4 days |
| 2 — Argo Rollouts | Canary + AnalysisTemplate | 4–5 days |
| 3 — Multi-env GitOps | AppProject + ApplicationSet + prod gate | 3–4 days |
| 4 — Kyverno | 4 policies + policy reports | 2–3 days |
| 5 — Observability | Loki + Tempo + Grafana dashboards + SLOs | 4–5 days |
| 6 — Chaos | 3 experiments + SLO correlation | 2–3 days |
| 7 — Security | Cosign + Sealed Secrets + NetworkPolicy | 2–3 days |
| 8 — Terraform | Module structure + bootstrap ordering | 2–3 days |
| 9 — Docs | Architecture, ADRs, runbooks, README | 2–3 days |

**Total: 5–7 weeks of consistent evening/weekend work**

This is not a weekend project. That is the point. Projects that take real time look like real work.
