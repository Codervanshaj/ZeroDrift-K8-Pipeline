# Runbook: Error Budget Response

## Overview
This runbook outlines the actions to take when the **ErrorBudgetBurnRate** alert fires, indicating that the Service Level Objective (SLO) for availability or latency is at risk of being breached.

## Procedure
1. **Acknowledge the Alert**: Claim the alert in the alerting system to let the team know you are investigating.
2. **Assess the Impact**:
   - Open the **Platform Overview** and **SLO Error Budget** Grafana dashboards.
   - Determine if the issue is a sudden spike in errors/latency (fast burn) or a slow degradation over time (slow burn).
3. **Investigate the Cause**:
   - Check **ArgoCD** for any recent deployments or changes that correlate with the start of the burn.
   - If a rollout is currently degraded, ensure it has aborted successfully.
   - Use the [Debugging with Traces](debug-with-traces.md) runbook to isolate the failing component.
4. **Mitigation**:
   - If caused by a recent deployment, initiate a Git revert (see [Rollback a Deployment](rollback-a-deployment.md)).
   - If caused by infrastructure (e.g., resource starvation), check HPA status or node capacity.
5. **Post-Incident Review**: If the SLO was breached, schedule a review meeting to discuss architectural or testing improvements.
