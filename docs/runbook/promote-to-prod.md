# Runbook: Promote to Production

## Overview
Production deployments are gated by a manual approval process in GitHub Actions and configured to `autoSync: false` in ArgoCD to provide a clear audit trail and deliberate promotion.

## Procedure
1. Navigate to the **Actions** tab in the GitHub repository.
2. Select the **Promote to Prod** workflow.
3. Click **Run workflow** and input the required `image-tag` that you wish to promote.
4. The workflow will automatically open a Pull Request updating `values-prod.yaml` for the services.
5. Review the Pull Request to ensure the changes are correct.
6. A designated approver must approve the deployment in the **GitHub Environments** protection rules (if configured) or simply approve and merge the PR.
7. Once merged, ArgoCD will detect the OutOfSync state.
8. Navigate to ArgoCD, review the diff, and click **Sync** on the `api-prod` and `worker-prod` applications to initiate the progressive delivery rollout.
