#!/usr/bin/env node
/**
 * Salesforce MCP Server
 *
 * Provides tools for interacting with Salesforce CRM:
 * - SOQL queries and SOSL searches
 * - Record CRUD (get, create, update, delete)
 * - Object metadata discovery
 * - API limit monitoring
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerQueryTools } from "./tools/query.js";
import { registerRecordTools } from "./tools/records.js";
import { registerMetadataTools } from "./tools/metadata.js";
import { registerDeployTools } from "./tools/deploy.js";
import { registerSandboxTools } from "./tools/sandbox.js";

const server = new McpServer({
  name: "salesforce-mcp-server",
  version: "1.0.0",
});

registerQueryTools(server);
registerRecordTools(server);
registerMetadataTools(server);
registerDeployTools(server);
registerSandboxTools(server);

async function main(): Promise<void> {
  const hasSfCliAuth = process.env.SALESFORCE_SF_CLI_USERNAME;
  const hasTokenAuth =
    process.env.SALESFORCE_ACCESS_TOKEN && process.env.SALESFORCE_INSTANCE_URL;
  const hasJwtAuth =
    process.env.SALESFORCE_CLIENT_ID &&
    process.env.SALESFORCE_USERNAME &&
    process.env.SALESFORCE_INSTANCE_URL &&
    process.env.SALESFORCE_PRIVATE_KEY_PATH;
  const hasPasswordAuth =
    process.env.SALESFORCE_CLIENT_ID &&
    process.env.SALESFORCE_CLIENT_SECRET &&
    process.env.SALESFORCE_USERNAME &&
    process.env.SALESFORCE_PASSWORD;

  if (!hasSfCliAuth && !hasTokenAuth && !hasJwtAuth && !hasPasswordAuth) {
    console.error(
      `ERROR: Missing Salesforce credentials.\n` +
        `\nOption 4 (SF CLI — recommended, auto-refreshes):\n` +
        `  SALESFORCE_SF_CLI_USERNAME=<user@example.com>\n` +
        `\nOption 1 (Access Token):\n` +
        `  SALESFORCE_ACCESS_TOKEN=<token>\n` +
        `  SALESFORCE_INSTANCE_URL=https://yourorg.my.salesforce.com\n` +
        `\nOption 2 (JWT Bearer):\n` +
        `  SALESFORCE_CLIENT_ID=<consumer_key>\n` +
        `  SALESFORCE_USERNAME=<user@example.com>\n` +
        `  SALESFORCE_INSTANCE_URL=https://yourorg.my.salesforce.com\n` +
        `  SALESFORCE_PRIVATE_KEY_PATH=</path/to/private_key.pem>\n` +
        `\nOption 3 (Username/Password):\n` +
        `  SALESFORCE_CLIENT_ID, SALESFORCE_CLIENT_SECRET, SALESFORCE_USERNAME, SALESFORCE_PASSWORD`
    );
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Salesforce MCP Server running via stdio");
}

main().catch((error: unknown) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
