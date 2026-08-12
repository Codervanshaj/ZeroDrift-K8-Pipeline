# ADR 001: Argo Rollouts vs Flagger

## Context
As part of the ZeroDrift GitOps Platform, we need a progressive delivery controller to enable canary deployments, automated analysis, and automated rollbacks based on Prometheus metrics. We want to ensure seamless integration with our existing GitOps workflow.

## Options Considered
1. **Argo Rollouts**: A Kubernetes controller and set of CRDs which provide advanced deployment capabilities such as blue-green, canary, canary analysis, experimentation, and progressive delivery features to Kubernetes.
2. **Flagger**: A progressive delivery tool that automates the release process for applications running on Kubernetes.

## Decision
We chose **Argo Rollouts** as the progressive delivery solution.

## Consequences
- **Positive**: Native integration with ArgoCD UI, enabling developers to visualize canary progression directly in the GitOps dashboard. The `AnalysisTemplate` structure is straightforward and integrates seamlessly with our Prometheus stack.
- **Negative**: Requires learning and migrating from standard Kubernetes `Deployment` resources to the `Rollout` custom resource.
