import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CHARACTER_LIMIT, ResponseFormat } from "../constants.js";
import { getSalesforceClient } from "../services/salesforce.js";
import type { SalesforceRecord } from "../types.js";

function formatRecord(record: SalesforceRecord): string {
  const { attributes, ...fields } = record as SalesforceRecord & {
    attributes?: unknown;
  };
  void attributes;
  return Object.entries(fields)
    .map(([k, v]) => `- **${k}**: ${v ?? "null"}`)
    .join("\n");
}

export function registerQueryTools(server: McpServer): void {
  // SOQL Query
  server.registerTool(
    "salesforce_query",
    {
      title: "Salesforce SOQL Query",
      description: `Execute a SOQL (Salesforce Object Query Language) query to retrieve records from Salesforce.

SOQL is similar to SQL. Example queries:
- SELECT Id, Name, Industry FROM Account WHERE Industry = 'Technology' LIMIT 10
- SELECT Id, Name, Email FROM Contact WHERE AccountId = '001xx000...'
- SELECT Id, Name, StageName, Amount FROM Opportunity WHERE CloseDate = THIS_YEAR

Args:
  - soql (string): A valid SOQL query string
  - limit (number): Max records to return from results (default: 20, max: 200)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  JSON: { totalSize, done, records[], nextRecordsUrl? }
  Markdown: Formatted table of results

Error: Returns descriptive error if query syntax is invalid or fields don't exist.`,
      inputSchema: z.object({
        soql: z
          .string()
          .min(10, "SOQL query must be at least 10 characters")
          .describe("SOQL query string (e.g., SELECT Id, Name FROM Account LIMIT 10)"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(200)
          .default(20)
          .describe("Maximum number of records to return (default: 20)"),
        response_format: z
          .nativeEnum(ResponseFormat)
          .default(ResponseFormat.MARKDOWN)
          .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable"),
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ soql, limit, response_format }) => {
      try {
        const sf = getSalesforceClient();
        const result = await sf.query(soql);
        const records = result.records.slice(0, limit);

        if (records.length === 0) {
          return { content: [{ type: "text", text: "No records found matching the query." }] };
        }

        const output = {
          totalSize: result.totalSize,
          returned: records.length,
          done: result.done,
          ...(result.nextRecordsUrl ? { nextRecordsUrl: result.nextRecordsUrl } : {}),
          records,
        };

        let text: string;
        if (response_format === ResponseFormat.JSON) {
          text = JSON.stringify(output, null, 2);
        } else {
          const lines = [
            `# Query Results`,
            `**Total**: ${result.totalSize} records | **Showing**: ${records.length}`,
            "",
          ];
          records.forEach((rec, i) => {
            lines.push(`## Record ${i + 1}`);
            lines.push(formatRecord(rec));
            lines.push("");
          });
          if (!result.done) {
            lines.push(`_More records available. Refine your query with LIMIT/OFFSET or add WHERE conditions._`);
          }
          text = lines.join("\n");
        }

        if (text.length > CHARACTER_LIMIT) {
          text = text.slice(0, CHARACTER_LIMIT) + "\n\n_Response truncated. Use a more specific query or reduce the limit._";
        }

        return {
          content: [{ type: "text", text }],
          structuredContent: output,
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );

  // SOSL Search
  server.registerTool(
    "salesforce_search",
    {
      title: "Salesforce SOSL Search",
      description: `Search across multiple Salesforce objects using SOSL (Salesforce Object Search Language).

Use SOSL when you want to search across multiple object types at once or do full-text search.

Example SOSL queries:
- FIND {Acme} IN ALL FIELDS RETURNING Account(Id, Name), Contact(Id, Name)
- FIND {john@example.com} IN EMAIL FIELDS RETURNING Contact(Id, Name, Email)
- FIND {urgent} IN ALL FIELDS RETURNING Case(Id, Subject, Status)

Args:
  - sosl (string): A valid SOSL query string
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  JSON: { searchRecords: [...] }
  Markdown: Formatted results grouped by object type`,
      inputSchema: z.object({
        sosl: z
          .string()
          .min(10, "SOSL query must be at least 10 characters")
          .describe("SOSL query string (e.g., FIND {Acme} IN ALL FIELDS RETURNING Account(Id, Name))"),
        response_format: z
          .nativeEnum(ResponseFormat)
          .default(ResponseFormat.MARKDOWN)
          .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable"),
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ sosl, response_format }) => {
      try {
        const sf = getSalesforceClient();
        const result = await sf.search(sosl);
        const records = result.searchRecords;

        if (records.length === 0) {
          return { content: [{ type: "text", text: "No records found matching the search." }] };
        }

        let text: string;
        if (response_format === ResponseFormat.JSON) {
          text = JSON.stringify({ count: records.length, searchRecords: records }, null, 2);
        } else {
          // Group by object type
          const byType = new Map<string, SalesforceRecord[]>();
          for (const rec of records) {
            const typeName = (rec.attributes as { type?: string } | undefined)?.type ?? "Unknown";
            if (!byType.has(typeName)) byType.set(typeName, []);
            byType.get(typeName)!.push(rec);
          }

          const lines = [`# Search Results (${records.length} total)`, ""];
          for (const [type, recs] of byType.entries()) {
            lines.push(`## ${type} (${recs.length})`);
            recs.forEach((rec) => {
              lines.push(formatRecord(rec));
              lines.push("");
            });
          }
          text = lines.join("\n");
        }

        if (text.length > CHARACTER_LIMIT) {
          text = text.slice(0, CHARACTER_LIMIT) + "\n\n_Response truncated. Narrow your search._";
        }

        return {
          content: [{ type: "text", text }],
          structuredContent: { count: records.length, searchRecords: records },
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }
  );
}
