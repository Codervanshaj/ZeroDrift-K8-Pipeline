# ADR 003: Loki vs Elasticsearch for Log Aggregation

## Context
To build a complete observability stack (metrics, logs, traces), we need a centralized log aggregation system to store and query application and infrastructure logs, correlating them with Prometheus metrics and Tempo traces.

## Options Considered
1. **Grafana Loki**: A horizontally scalable, highly available, multi-tenant log aggregation system inspired by Prometheus.
2. **Elasticsearch (ELK Stack)**: A distributed, RESTful search and analytics engine.

## Decision
We chose **Grafana Loki**.

## Consequences
- **Positive**: Significantly lower resource overhead than Elasticsearch as it only indexes labels instead of the full log text. Native integration with Prometheus and Grafana. Allows easy jumping from traces in Tempo to logs in Loki based on `traceId`.
- **Negative**: LogQL can be slightly complex for developers used to full-text search in Kibana.
