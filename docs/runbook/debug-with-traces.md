# Runbook: Debugging with Traces

## Overview
When an application issue or latency spike occurs, we can use the integrated observability stack (Tempo and Loki) to trace the exact request path and view correlated logs.

## Procedure
1. Open the **Grafana Dashboard**.
2. Navigate to the **Explore** tab.
3. Select **Tempo** as the data source.
4. If you have a specific `traceId` from an error log or frontend console, enter it directly. Otherwise, query for traces with high duration (e.g., > 500ms) or errors in the `frontend-service` or `backend-service`.
5. Click on a trace to visualize the span breakdown across the microservices.
6. Click on the **Logs for this span** (or similar icon linked to Loki) to jump directly to the structured logs emitted by the service during that exact request.
7. Use the correlated logs to identify the root cause of the error or bottleneck.
