# Sealed Secrets

This directory contains the `SealedSecret` resources for sensitive data in the GitOps pipeline.

## How to seal a new secret

1. Ensure you have the `kubeseal` CLI installed.
2. Create a standard Kubernetes Secret (do NOT commit this file!):
   ```yaml
   # secret.yaml
   apiVersion: v1
   kind: Secret
   metadata:
     name: my-secret
     namespace: my-namespace
   type: Opaque
   stringData:
     password: "super-secret-password"
   ```
3. Seal the secret using your cluster's public certificate:
   ```bash
   kubeseal -f secret.yaml -w sealed-secret.yaml
   ```
4. Commit the generated `sealed-secret.yaml` file into this directory.
5. The `SealedSecret` controller running in the cluster will automatically unseal it and create the native Kubernetes Secret.

## Existing Secrets

- `grafana-admin-sealed.yaml`: Contains the admin user/password for Grafana.
- `argocd-notifications-sealed.yaml`: Contains the Slack webhook URL for ArgoCD notifications.
