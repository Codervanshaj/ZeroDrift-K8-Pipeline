# ADR 002: Kyverno vs OPA Gatekeeper

## Context
We need a policy engine to enforce security, governance, and compliance policies across the cluster, preventing misconfigurations and ensuring all deployments adhere to zero-drift principles (e.g., resource limits, specific registries, image signatures).

## Options Considered
1. **Kyverno**: A policy engine designed specifically for Kubernetes that uses native Kubernetes resources for defining policies.
2. **OPA Gatekeeper**: A customizable admission webhook for Kubernetes that enforces policies executed by the Open Policy Agent, written in Rego.

## Decision
We chose **Kyverno**.

## Consequences
- **Positive**: Policies can be written in standard YAML instead of Rego, making it much easier for developers to write and understand policies. Native capabilities for mutation and generation. Strong integration with policy reports for Grafana visualization.
- **Negative**: Sometimes higher memory overhead compared to OPA Gatekeeper for massive clusters.
