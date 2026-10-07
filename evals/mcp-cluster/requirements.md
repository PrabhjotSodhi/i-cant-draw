# MCP Cluster Architecture

Create an architecture diagram for an MCP (Model Context Protocol) cluster deployment.

An MCP Client connects to an MCP Proxy Service. The proxy authenticates
requests through Keycloak, which federates identity to Entra (external
cloud identity provider).

The MCP Proxy uses two backing stores:
- An Auth State Store in Redis (session tokens, short-lived)
- A Proxy Config database (routing rules, tenant config)

The proxy forwards authorized requests to an MCP Wrapper Service. The
wrapper emits logs and traces to a Telemetry Collector, which ships them
to Datadog (external observability platform).

All internal services run inside a single Cluster: Keycloak, MCP Proxy,
Auth State Store, Proxy Config, MCP Wrapper, and Telemetry Collector.
The MCP Client and Entra sit outside the cluster. Datadog is external.
