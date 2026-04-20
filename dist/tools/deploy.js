import { z } from "zod";
import { SUPPORTED_METADATA_TYPES, createTempSfdxProject, writeMetadataFiles, cleanupProject, resolveMetadataPaths, runSfJson, readRetrievedFiles, } from "../services/sfCli.js";
import { isDeployDisabled } from "../permissions.js";
// Policy:
//   SALESFORCE_READONLY=true   → deploy blocked (even dry-run)
//   Non-owner caller           → deploy blocked (owner-only safeguard)
//   SALESFORCE_NO_DELETE=true  → deploy allowed for owners (deploy is upsert, not delete)
// retrieve is always allowed (read-only).
function requireTargetOrg() {
    const target = process.env.SALESFORCE_SF_CLI_USERNAME;
    if (!target) {
        throw new Error("Deploy/retrieve tools require SALESFORCE_SF_CLI_USERNAME (SF CLI auth). " +
            "Run 'sf org login web --instance-url <url>' to authorize an org, then set the env var.");
    }
    return target;
}
const metadataTypeEnum = z.enum(SUPPORTED_METADATA_TYPES);
const API_NAME_REGEX = /^[A-Za-z][A-Za-z0-9_]*$/;
export function registerDeployTools(server) {
    // Deploy metadata
    server.registerTool("salesforce_deploy_metadata", {
        title: "Deploy Salesforce Metadata",
        description: `Deploy a metadata component (Flow, ApexClass, ValidationRule, etc.) to the Salesforce org via the SF CLI.

Use this to create OR update declarative metadata. Salesforce deploy is upsert-style:
if 'api_name' already exists in the org, this overwrites it.

Typical workflow for creating a new Flow:
  1. (Optional) salesforce_retrieve_metadata to pull an existing Flow as a template
  2. Author the Flow XML (<Flow xmlns="http://soap.sforce.com/2006/04/metadata">...)
  3. Call this tool with check_only=true to validate (dry-run)
  4. Re-run with check_only=false to actually deploy

Supported metadata types:
  ${SUPPORTED_METADATA_TYPES.join(", ")}

Args:
  - metadata_type: One of the supported types above.
  - api_name: Metadata API name, e.g. 'My_New_Flow'. Must match Salesforce naming rules.
  - xml_content: Full *-meta.xml content. For Flows, a complete <Flow> document.
  - body_content: Required for ApexClass (.cls body) and ApexTrigger (.trigger body).
  - object_name: Required for ValidationRule — parent sObject (e.g. 'Account').
  - check_only: If true, validate without committing (dry-run). Default: false.

Blocked entirely when SALESFORCE_READONLY=true (including dry-runs).
Requires SALESFORCE_SF_CLI_USERNAME and the Salesforce user to have metadata deploy
permissions (e.g. 'Customize Application' or 'Modify Metadata Through Metadata API Functions').

Returns:
  Deploy status with per-component successes and failures (with error messages).`,
        inputSchema: z.object({
            metadata_type: metadataTypeEnum.describe(`Metadata type. Supported: ${SUPPORTED_METADATA_TYPES.join(", ")}`),
            api_name: z
                .string()
                .min(1)
                .regex(API_NAME_REGEX, "Must be a valid Salesforce API name (alphanumeric + underscores, starts with a letter)")
                .describe("Metadata API name (e.g., My_New_Flow)"),
            xml_content: z
                .string()
                .min(1)
                .describe("Full *-meta.xml content for the component"),
            body_content: z
                .string()
                .optional()
                .describe("Body text — required for ApexClass (.cls) and ApexTrigger (.trigger)"),
            object_name: z
                .string()
                .optional()
                .describe("Parent sObject API name — required for ValidationRule"),
            check_only: z
                .boolean()
                .default(false)
                .describe("Validate only (dry-run). Default: false"),
        }).strict(),
        annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            idempotentHint: false,
            openWorldHint: true,
        },
    }, async ({ metadata_type, api_name, xml_content, body_content, object_name, check_only, }) => {
        if (isDeployDisabled()) {
            return {
                isError: true,
                content: [
                    {
                        type: "text",
                        text: "❌ 메타데이터 배포 권한이 없습니다.",
                    },
                ],
            };
        }
        let projectDir;
        try {
            const targetOrg = requireTargetOrg();
            const paths = resolveMetadataPaths(metadata_type, api_name, object_name);
            projectDir = createTempSfdxProject();
            writeMetadataFiles(projectDir, paths, xml_content, body_content);
            const args = [
                "project",
                "deploy",
                "start",
                "--source-dir",
                "force-app",
                "--target-org",
                targetOrg,
                "--wait",
                "10",
            ];
            if (check_only)
                args.push("--dry-run");
            const result = runSfJson(args, { cwd: projectDir });
            const success = result.result?.success === true ||
                (result.status === 0 && (result.result?.numberComponentErrors ?? 0) === 0);
            const verb = check_only ? "Validation" : "Deploy";
            const headline = success
                ? `${verb} succeeded for ${metadata_type}: ${api_name}`
                : `${verb} failed for ${metadata_type}: ${api_name}`;
            const details = result.result?.details;
            const failures = details?.componentFailures ?? [];
            const successes = details?.componentSuccesses ?? result.result?.deployedSource ?? [];
            const lines = [
                `# ${headline}`,
                "",
                `- **Target org**: ${targetOrg}`,
                `- **Dry-run**: ${check_only}`,
                `- **Status**: ${result.result?.status ?? (success ? "Succeeded" : "Failed")}`,
                "",
            ];
            if (failures.length > 0) {
                lines.push("## Failures");
                for (const f of failures) {
                    const name = String(f.fullName ?? "");
                    const ctype = String(f.componentType ?? "");
                    const problem = String(f.problem ?? f.error ?? "unknown error");
                    lines.push(`- **${name}** (${ctype}): ${problem}`);
                }
                lines.push("");
            }
            if (!success && result.message) {
                lines.push(`**Error**: ${result.message}`);
                lines.push("");
            }
            if (successes.length > 0) {
                lines.push(`## Deployed components (${successes.length})`);
                for (const s of successes) {
                    lines.push(`- ${String(s.fullName ?? s.filePath ?? "")}`);
                }
            }
            return {
                content: [{ type: "text", text: lines.join("\n") }],
                structuredContent: {
                    success,
                    dryRun: check_only,
                    targetOrg,
                    result: result.result,
                    message: result.message,
                },
                ...(success ? {} : { isError: true }),
            };
        }
        catch (error) {
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
        finally {
            if (projectDir)
                cleanupProject(projectDir);
        }
    });
    // Retrieve metadata
    server.registerTool("salesforce_retrieve_metadata", {
        title: "Retrieve Salesforce Metadata",
        description: `Retrieve a metadata component (Flow, ApexClass, ValidationRule, etc.) from the Salesforce org as XML via SF CLI.

Use this to:
  - Inspect an existing Flow's XML as a reference before authoring a new one
  - Fetch a component, modify the XML, then redeploy via salesforce_deploy_metadata

Supported metadata types: ${SUPPORTED_METADATA_TYPES.join(", ")}

Args:
  - metadata_type: The type of metadata to retrieve
  - api_name: Metadata API name
  - object_name: Required for ValidationRule (parent sObject)

Requires SALESFORCE_SF_CLI_USERNAME. This tool is read-only — allowed even under SALESFORCE_READONLY.

Returns:
  The raw *-meta.xml content (and .cls/.trigger body for Apex).`,
        inputSchema: z.object({
            metadata_type: metadataTypeEnum.describe(`Metadata type. Supported: ${SUPPORTED_METADATA_TYPES.join(", ")}`),
            api_name: z
                .string()
                .min(1)
                .regex(API_NAME_REGEX, "Must be a valid Salesforce API name (alphanumeric + underscores, starts with a letter)")
                .describe("Metadata API name"),
            object_name: z
                .string()
                .optional()
                .describe("Parent sObject API name — required for ValidationRule"),
        }).strict(),
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true,
        },
    }, async ({ metadata_type, api_name, object_name }) => {
        let projectDir;
        try {
            const targetOrg = requireTargetOrg();
            const paths = resolveMetadataPaths(metadata_type, api_name, object_name);
            projectDir = createTempSfdxProject();
            const metadataArg = metadata_type === "ValidationRule"
                ? `ValidationRule:${object_name}.${api_name}`
                : `${metadata_type}:${api_name}`;
            const args = [
                "project",
                "retrieve",
                "start",
                "--metadata",
                metadataArg,
                "--target-org",
                targetOrg,
                "--wait",
                "10",
            ];
            runSfJson(args, { cwd: projectDir });
            const { xml, body } = readRetrievedFiles(projectDir, paths);
            const lines = [
                `# ${metadata_type}: ${api_name}`,
                "",
                `- **Target org**: ${targetOrg}`,
                "",
                "## Meta XML",
                "```xml",
                xml,
                "```",
            ];
            if (body !== undefined) {
                lines.push("", "## Body", "```", body, "```");
            }
            return {
                content: [{ type: "text", text: lines.join("\n") }],
                structuredContent: { metadata_type, api_name, xml, body },
            };
        }
        catch (error) {
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
        finally {
            if (projectDir)
                cleanupProject(projectDir);
        }
    });
}
//# sourceMappingURL=deploy.js.map