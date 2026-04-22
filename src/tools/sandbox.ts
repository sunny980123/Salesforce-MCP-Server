import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CHARACTER_LIMIT, ResponseFormat } from "../constants.js";
import { getSalesforceClient } from "../services/salesforce.js";
import { canDeploy } from "../permissions.js";

// Salesforce SandboxInfo.LicenseType values
const LICENSE_TYPES = ["DEVELOPER", "DEVELOPER_PRO", "PARTIAL", "FULL"] as const;

// SandboxName rules: up to 10 chars, alphanumeric, starts with letter
const SANDBOX_NAME_REGEX = /^[A-Za-z][A-Za-z0-9]{0,9}$/;

function truncate(text: string): string {
  if (text.length > CHARACTER_LIMIT) {
    return text.slice(0, CHARACTER_LIMIT) + "\n\n_Response truncated._";
  }
  return text;
}

export function registerSandboxTools(server: McpServer): void {
  // ---------------- salesforce_list_sandboxes ----------------
  server.registerTool(
    "salesforce_list_sandboxes",
    {
      title: "List Salesforce Sandboxes",
      description: `List all sandboxes registered under the production org via Tooling API SandboxInfo.

Shows both existing sandboxes and in-progress creations. For status of an in-progress
creation, also check SandboxProcess records (use salesforce_metadata_query).

Args:
  - include_in_progress (bool): include SandboxProcess records for pending creations (default: true)

Returns:
  - SandboxInfo list: Id, SandboxName, LicenseType, Description, Status
  - (optional) SandboxProcess list: recent creation progress

Note: This tool must be run against the PRODUCTION org (sandboxes live under prod).`,
      inputSchema: z.object({
        include_in_progress: z.boolean().default(true),
        response_format: z.nativeEnum(ResponseFormat).default(ResponseFormat.MARKDOWN),
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ include_in_progress, response_format }) => {
      try {
        const sf = getSalesforceClient();
        const info = await sf.toolingQuery(
          "SELECT Id, SandboxName, LicenseType, Description FROM SandboxInfo ORDER BY SandboxName"
        );
        const processes = include_in_progress
          ? await sf
              .toolingQuery(
                "SELECT Id, SandboxName, Status, CopyProgress, LicenseType, Description, StartDate, EndDate FROM SandboxProcess ORDER BY CreatedDate DESC LIMIT 20"
              )
              .catch(() => ({ totalSize: 0, done: true, records: [] as Record<string, unknown>[] }))
          : null;

        const output = {
          sandboxes: info.records,
          in_progress: processes?.records ?? [],
        };

        if (response_format === ResponseFormat.JSON) {
          return {
            content: [{ type: "text", text: truncate(JSON.stringify(output, null, 2)) }],
            structuredContent: output as unknown as Record<string, unknown>,
          };
        }

        const lines = [
          `# Sandboxes (${info.totalSize})`,
          "",
          "| SandboxName | License | Description |",
          "|-------------|---------|-------------|",
        ];
        for (const rec of info.records as Array<Record<string, unknown>>) {
          lines.push(
            `| \`${String(rec.SandboxName ?? "-")}\` | ${String(rec.LicenseType ?? "-")} | ${String(rec.Description ?? "")} |`
          );
        }
        if (processes && processes.records.length) {
          lines.push("", `## Recent SandboxProcess (${processes.records.length})`, "");
          lines.push("| SandboxName | Status | CopyProgress | License | Start | End |");
          lines.push("|-------------|:------:|:------------:|:-------:|-------|-----|");
          for (const rec of processes.records as Array<Record<string, unknown>>) {
            lines.push(
              `| \`${String(rec.SandboxName ?? "-")}\` | ${String(rec.Status ?? "-")} | ${String(rec.CopyProgress ?? 0)}% | ${String(rec.LicenseType ?? "-")} | ${String(rec.StartDate ?? "-")} | ${String(rec.EndDate ?? "-")} |`
            );
          }
        }

        return {
          content: [{ type: "text", text: truncate(lines.join("\n")) }],
          structuredContent: output as unknown as Record<string, unknown>,
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );

  // ---------------- salesforce_create_sandbox ----------------
  server.registerTool(
    "salesforce_create_sandbox",
    {
      title: "Create Salesforce Sandbox",
      description: `Create a new sandbox via Tooling API SandboxInfo. Requires Manage Sandboxes permission.

Creation is asynchronous and can take minutes (Developer) to hours (Full).
After creation, a SandboxProcess record tracks progress — use salesforce_list_sandboxes
with include_in_progress=true to monitor.

Args:
  - sandbox_name: 1-10 chars, letters/digits, must start with a letter. Case-sensitive.
  - license_type: DEVELOPER (default) | DEVELOPER_PRO | PARTIAL | FULL
  - description (optional): free-form description

Notes:
  - DEVELOPER: config-only, metadata copy, refreshable daily
  - DEVELOPER_PRO: same as DEVELOPER with more storage
  - PARTIAL: sample of prod data (up to 5GB)
  - FULL: complete prod clone (costly, limited quota)
  - Must run against PRODUCTION org. After creation, connect via:
    sf org login web -r https://test.salesforce.com
    and register a separate MCP entry targeting the sandbox username.

Caller must be in owner or deployer allowlist.`,
      inputSchema: z.object({
        sandbox_name: z
          .string()
          .regex(SANDBOX_NAME_REGEX, "1-10 chars, letters/digits only, must start with a letter"),
        license_type: z.enum(LICENSE_TYPES).default("DEVELOPER"),
        description: z.string().max(255).optional(),
      }).strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ sandbox_name, license_type, description }) => {
      if (!canDeploy()) {
        return {
          isError: true,
          content: [{ type: "text", text: "❌ sandbox 생성 권한이 없습니다." }],
        };
      }
      try {
        const sf = getSalesforceClient();
        const body: Record<string, unknown> = {
          SandboxName: sandbox_name,
          LicenseType: license_type,
        };
        if (description) body.Description = description;

        const result = await sf.toolingCreate("SandboxInfo", body);

        const text =
          `✅ Sandbox 생성 요청 접수됨.\n` +
          `- **SandboxInfo Id**: ${result.id}\n` +
          `- **SandboxName**: ${sandbox_name}\n` +
          `- **License**: ${license_type}\n\n` +
          `생성은 비동기로 진행됩니다. 진행 상태는 salesforce_list_sandboxes로 확인하세요.\n` +
          `완료 후 접속은:\n` +
          `  sf org login web -r https://test.salesforce.com\n` +
          `  (프롬프트에서 sandbox username 입력 — 보통 원래username.${sandbox_name.toLowerCase()})`;

        return {
          content: [{ type: "text", text }],
          structuredContent: result as unknown as Record<string, unknown>,
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );
}
