# Flink

Use this skill when the user asks to publish, inspect, update, configure, or rollback Flink sites on this server.

## Server

- Flink server: https://csweichel.dev
- MCP endpoint: https://csweichel.dev/mcp
- Tenant: bwl21
- Auth: HTTP Basic Auth with tenant username and password.

## Rules

- Ask for the tenant password if it is not already available in a secure local configuration.
- Never put tenant passwords, Basic Auth headers, API keys, or other secrets into hosted browser files.
- Prefer the Flink MCP tools for site operations.
- Keep sites owner-only unless the user explicitly asks to share them.
- Use flink_publish_site for new publishes, then verify the returned URL.
- Use flink_get_site and flink_read_file before editing an existing site.
- Use flink_set_site_auth only when the user asks to change access.

## Common Flows

Publish a site:
1. Prepare static files.
2. Call `flink_publish_site` with the site slug and file list.
3. Open or fetch the returned URL to verify the page loads.

Update a site:
1. Call `flink_get_site`.
2. Read the files you need.
3. Write or publish updated files.
4. Verify the live URL.

Configure access:
- owner: only this tenant can view.
- none: anonymous viewers can view and use allowed browser APIs.
- tenants: approved tenants can view, optionally restricted to a tenant allow-list.