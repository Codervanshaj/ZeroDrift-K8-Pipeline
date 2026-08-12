# ADR 005: Terraform Boundary for GitOps Bootstrap

## Context
We need a reproducible way to bootstrap the cluster infrastructure from zero before ArgoCD and the GitOps workflow can take over. We must define the exact boundary of what Terraform manages vs what ArgoCD manages.

## Options Considered
1. **Terraform manages everything**: Using Terraform to deploy all Helm charts, applications, and policies.
2. **Terraform only bootstraps GitOps prerequisites**: Terraform deploys only the controllers needed for GitOps and Policy enforcement, then hands off to ArgoCD.

## Decision
We chose **Terraform only bootstraps GitOps prerequisites** (Option 2).

## Consequences
- **Positive**: Clear separation of concerns. Terraform manages stateful prerequisites (Sealed Secrets controller, ArgoCD, Argo Rollouts CRDs, Kyverno). ArgoCD manages continuous delivery of applications and observability tools. Eliminates Terraform state drift issues for application deployments.
- **Negative**: Requires understanding dependency ordering and `time_sleep` resources in Terraform to ensure CRDs are registered before ArgoCD tries to deploy resources relying on them.
