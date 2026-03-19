import { z } from "zod";
import { CHARACTER_LIMIT, ResponseFormat } from "../constants.js";
import { getSalesforceClient } from "../services/salesforce.js";
export function registerMetadataTools(server) {
    // Describe Object
    server.registerTool("salesforce_describe_object", {
        title: "Describe Salesforce Object",
        description: `Get metadata for a Salesforce object: field names, types, labels, and whether fields are required/editable.

Use this to discover what fields are available before writing SOQL queries or creating/updating records.

Args:
  - object_type (string): The Salesforce object API name (e.g., 'Account', 'Contact', 'Opportunity__c')
  - include_picklists (boolean): Whether to include picklist values for picklist fields (default: false)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  Object metadata including:
  - All field API names, labels, and data types
  - Required fields
  - Createable and updateable flags
  - Picklist values (if requested)`,
        inputSchema: z.object({
            object_type: z
                .string()
                .min(1)
                .describe("Salesforce object API name (e.g., Account, Contact, Opportunity, MyCustomObject__c)"),
            include_picklists: z
                .boolean()
                .default(false)
                .describe("Whether to include picklist values for picklist/multipicklist fields"),
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
    }, async ({ object_type, include_picklists, response_format }) => {
        try {
            const sf = getSalesforceClient();
            const describe = await sf.describeObject(object_type);
            const fields = describe.fields.map((f) => ({
                name: f.name,
                label: f.label,
                type: f.type,
                required: !f.nillable && f.createable,
                createable: f.createable,
                updateable: f.updateable,
                ...(include_picklists && f.picklistValues?.length
                    ? { picklistValues: f.picklistValues.filter((p) => p.active).map((p) => p.value) }
                    : {}),
            }));
            const output = {
                name: describe.name,
                label: describe.label,
                labelPlural: describe.labelPlural,
                createable: describe.createable,
                updateable: describe.updateable,
                deletable: describe.deletable,
                fieldCount: fields.length,
                fields,
            };
            let text;
            if (response_format === ResponseFormat.JSON) {
                text = JSON.stringify(output, null, 2);
            }
            else {
                const lines = [
                    `# ${describe.label} (${describe.name})`,
                    "",
                    `| Capability | Value |`,
                    `|---|---|`,
                    `| Createable | ${describe.createable} |`,
                    `| Updateable | ${describe.updateable} |`,
                    `| Deletable | ${describe.deletable} |`,
                    `| Total Fields | ${fields.length} |`,
                    "",
                    `## Fields`,
                    "",
                    `| API Name | Label | Type | Required | Createable | Updateable |`,
                    `|---|---|---|---|---|---|`,
                ];
                for (const f of fields) {
                    lines.push(`| ${f.name} | ${f.label} | ${f.type} | ${f.required ? "✓" : ""} | ${f.createable ? "✓" : ""} | ${f.updateable ? "✓" : ""} |`);
                    if (include_picklists && f.picklistValues?.length) {
                        lines.push(`|   | _Values: ${f.picklistValues.join(", ")}_ |  |  |  |  |`);
                    }
                }
                text = lines.join("\n");
            }
            if (text.length > CHARACTER_LIMIT) {
                text =
                    text.slice(0, CHARACTER_LIMIT) +
                        `\n\n_Response truncated. There are ${fields.length} fields total. Use response_format='json' and filter the fields array._`;
            }
            return {
                content: [{ type: "text", text }],
                structuredContent: output,
            };
        }
        catch (error) {
            return {
                isError: true,
                content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
            };
        }
    });
    // List Objects
    server.registerTool("salesforce_list_objects", {
        title: "List Salesforce Objects",
        description: `List all available Salesforce objects (standard and custom) in the org.

Use this to discover what objects exist before querying or manipulating data.

Args:
  - filter (string): Optional text to filter object names/labels (case-insensitive)
  - queryable_only (boolean): If true, only return objects that support SOQL queries (default: true)
  - limit (number): Maximum number of objects to return (default: 50, max: 500)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  List of objects with their names, labels, and CRUD capabilities.`,
        inputSchema: z.object({
            filter: z
                .string()
                .default("")
                .describe("Optional text filter applied to object name or label (case-insensitive)"),
            queryable_only: z
                .boolean()
                .default(true)
                .describe("If true, only return objects that support SOQL queries"),
            limit: z
                .number()
                .int()
                .min(1)
                .max(500)
                .default(50)
                .describe("Maximum number of objects to return (default: 50)"),
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
    }, async ({ filter, queryable_only, limit, response_format }) => {
        try {
            const sf = getSalesforceClient();
            const allObjects = await sf.listObjects();
            let filtered = allObjects;
            if (queryable_only) {
                filtered = filtered.filter((o) => o.queryable);
            }
            if (filter) {
                const lower = filter.toLowerCase();
                filtered = filtered.filter((o) => o.name.toLowerCase().includes(lower) ||
                    o.label.toLowerCase().includes(lower));
            }
            const total = filtered.length;
            const objects = filtered.slice(0, limit).map((o) => ({
                name: o.name,
                label: o.label,
                labelPlural: o.labelPlural,
                queryable: o.queryable,
                createable: o.createable,
                updateable: o.updateable,
                deletable: o.deletable,
            }));
            const output = {
                total,
                returned: objects.length,
                has_more: total > limit,
                objects,
            };
            let text;
            if (response_format === ResponseFormat.JSON) {
                text = JSON.stringify(output, null, 2);
            }
            else {
                const lines = [
                    `# Salesforce Objects (${objects.length} of ${total})`,
                    "",
                    `| API Name | Label | Query | Create | Update | Delete |`,
                    `|---|---|---|---|---|---|`,
                ];
                for (const o of objects) {
                    lines.push(`| ${o.name} | ${o.label} | ${o.queryable ? "✓" : ""} | ${o.createable ? "✓" : ""} | ${o.updateable ? "✓" : ""} | ${o.deletable ? "✓" : ""} |`);
                }
                if (output.has_more) {
                    lines.push("", `_Showing first ${limit} of ${total} objects. Use 'filter' parameter to narrow results._`);
                }
                text = lines.join("\n");
            }
            return {
                content: [{ type: "text", text }],
                structuredContent: output,
            };
        }
        catch (error) {
            return {
                isError: true,
                content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
            };
        }
    });
}
//# sourceMappingURL=metadata.js.map