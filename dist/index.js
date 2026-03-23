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
const server = new McpServer({
    name: "salesforce-mcp-server",
    version: "1.0.0",
});
registerQueryTools(server);
registerRecordTools(server);
registerMetadataTools(server);
async function main() {
    const hasTokenAuth = process.env.SALESFORCE_ACCESS_TOKEN && process.env.SALESFORCE_INSTANCE_URL;
    const hasPasswordAuth = process.env.SALESFORCE_CLIENT_ID &&
        process.env.SALESFORCE_CLIENT_SECRET &&
        process.env.SALESFORCE_USERNAME &&
        process.env.SALESFORCE_PASSWORD;
    if (!hasTokenAuth && !hasPasswordAuth) {
        console.error(`ERROR: Missing Salesforce credentials.\n` +
            `\nOption 1 (Access Token):\n` +
            `  SALESFORCE_ACCESS_TOKEN=<token>\n` +
            `  SALESFORCE_INSTANCE_URL=https://yourorg.my.salesforce.com\n` +
            `\nOption 2 (Username/Password):\n` +
            `  SALESFORCE_CLIENT_ID, SALESFORCE_CLIENT_SECRET, SALESFORCE_USERNAME, SALESFORCE_PASSWORD`);
        process.exit(1);
    }
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Salesforce MCP Server running via stdio");
}
main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map