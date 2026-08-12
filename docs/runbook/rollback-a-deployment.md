# Runbook: Rollback a Deployment

## Overview
This runbook describes the procedure to manually abort an in-progress canary deployment or rollback a successful deployment to a previous version. By design, Argo Rollouts performs automated rollbacks if the `AnalysisTemplate` fails, but manual intervention may sometimes be necessary.

## Procedure: Abort an In-Progress Canary
If a canary rollout is stuck or exhibiting issues that metrics haven't caught yet:
1. Use the ArgoCD UI or CLI to view the Rollout status.
2. Click **Abort** in the ArgoCD UI under the Rollout resource, or run:
   ```bash
   kubectl argo rollouts abort <rollout-name> -n <namespace>
   ```
3. The Rollout will immediately scale down the canary pods and route 100% of traffic back to the stable version.

## Procedure: Rollback a Fully Promoted Release
Since this is a GitOps platform, rolling back a completed release requires reverting the change in Git:
1. Locate the Pull Request or commit that changed the `values-prod.yaml` (e.g., bumping the image tag).
2. Revert the commit in Git and push to the main branch.
3. ArgoCD will detect the configuration drift and automatically sync the cluster state back to the previous image tag, triggering a new deployment process for the old version.
