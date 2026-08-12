# Runbook: Chaos Experiment Guide

## Overview
Chaos Mesh runs scheduled experiments in our environments to validate system resilience. This guide explains how to view, pause, or manually trigger these experiments.

## Procedure: Viewing Chaos Experiments
1. Open the Chaos Mesh Dashboard (accessible via port-forwarding the `chaos-dashboard` service).
2. Alternatively, view the Chaos CRDs via `kubectl`:
   ```bash
   kubectl get podchaos,networkchaos,stresschaos -n chaos-testing
   ```

## Procedure: Pausing/Disabling Experiments
If the cluster is experiencing genuine instability and you need to halt chaos experiments:
1. Suspend an individual experiment:
   ```bash
   kubectl annotate podchaos backend-service-pod-failure experiment.chaos-mesh.org/pause=true -n chaos-testing
   ```
2. Or, for a GitOps approach, edit the YAML files in `chaos/` and set `suspend: true` in the spec, then commit. ArgoCD will sync the change and pause the schedule.

## Procedure: Manual Trigger
To trigger an experiment outside of its cron schedule for testing:
1. Apply the chaos manifest manually without the `scheduler` block, or use the Chaos Mesh UI to create a one-off experiment based on the existing templates.
