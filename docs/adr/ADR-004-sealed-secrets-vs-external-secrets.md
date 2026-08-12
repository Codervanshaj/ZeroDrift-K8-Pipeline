# ADR 004: Sealed Secrets vs External Secrets Operator

## Context
A true GitOps platform requires all configurations, including secrets, to be stored in the Git repository without exposing plaintext sensitive information.

## Options Considered
1. **Sealed Secrets**: Encrypts Secrets into a `SealedSecret` resource, which is safe to store in public/private repositories. The controller decrypts them into standard Kubernetes Secrets in the cluster.
2. **External Secrets Operator (ESO)**: Integrates with external secret management systems (like AWS Secrets Manager, HashiCorp Vault) to inject secrets into the cluster.

## Decision
We chose **Sealed Secrets**.

## Consequences
- **Positive**: Simple bootstrapping without relying on external cloud provider resources (like AWS/GCP KMS) or running a complex Vault instance. Fits perfectly into the self-contained cluster design.
- **Negative**: Key rotation and management of the sealing key requires careful operational handling, especially in disaster recovery scenarios.
