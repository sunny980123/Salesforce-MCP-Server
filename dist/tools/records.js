import { z } from "zod";
import { ResponseFormat } from "../constants.js";
import { getSalesforceClient } from "../services/salesforce.js";
const COMMON_OBJECTS = [
    "Account", "Contact", "Lead", "Opportunity", "Case",
    "Task", "Event", "Campaign", "Product2", "Pricebook2",
    "Contract", "Order", "Quote", "User",
];
const isReadOnly = process.env.SALESFORCE_READONLY === "true";
export function registerRecordTools(server) {
    // Get Record
    server.registerTool("salesforce_get_record", {
        title: "Get Salesforce Record",
        description: `Retrieve a single Salesforce record by its ID.

Args:
  - object_type (string): The Salesforce object type (e.g., 'Account', 'Contact', 'Opportunity')
  - record_id (string): The 15 or 18-character Salesforce record ID
  - fields (string[]): Optional list of specific fields to retrieve. If empty, returns all fields.
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  The full record with all requested fields.

Examples:
  - Get an account: object_type='Account', record_id='001xx000003...'
  - Get specific contact fields: object_type='Contact', record_id='003xx...', fields=['Name','Email','Phone']`,
        inputSchema: z.object({
            object_type: z
                .string()
                .min(1)
                .describe("Salesforce object type (e.g., Account, Contact, Opportunity, Case, Lead)"),
            record_id: z
                .string()
                .min(15)
                .max(18)
                .describe("15 or 18-character Salesforce record ID"),
            fields: z
                .array(z.string())
                .default([])
                .describe("Optional list of field API names to retrieve. Empty means all fields."),
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
    }, async ({ object_type, record_id, fields, response_format }) => {
        try {
            const sf = getSalesforceClient();
            const record = await sf.getRecord(object_type, record_id, fields.length ? fields : undefined);
            let text;
            if (response_format === ResponseFormat.JSON) {
                text = JSON.stringify(record, null, 2);
            }
            else {
                const { attributes, Id, ...rest } = record;
                void attributes;
                const lines = [
                    `# ${object_type}: ${String(record.Name ?? record.Id)}`,
                    `**ID**: ${Id}`,
                    "",
                ];
                for (const [k, v] of Object.entries(rest)) {
                    if (v !== null && v !== undefined) {
                        lines.push(`- **${k}**: ${String(v)}`);
                    }
                }
                text = lines.join("\n");
            }
            return {
                content: [{ type: "text", text }],
                structuredContent: record,
            };
        }
        catch (error) {
            return {
                isError: true,
                content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
            };
        }
    });
    // Create Record
    server.registerTool("salesforce_create_record", {
        title: "Create Salesforce Record",
        description: `Create a new record in Salesforce.

Args:
  - object_type (string): The Salesforce object type (e.g., 'Account', 'Contact', 'Lead')
  - fields (object): Key-value pairs of field API names and their values

Returns:
  { id: string, success: boolean } - The new record ID on success.

Common required fields:
  - Account: Name (required)
  - Contact: LastName (required), AccountId (optional)
  - Lead: LastName + Company (required)
  - Opportunity: Name + StageName + CloseDate (required)
  - Case: Subject (required)

Examples:
  - Create account: object_type='Account', fields={ "Name": "Acme Corp", "Industry": "Technology" }
  - Create lead: object_type='Lead', fields={ "FirstName": "John", "LastName": "Doe", "Company": "Acme", "Email": "john@acme.com" }`,
        inputSchema: z.object({
            object_type: z
                .string()
                .min(1)
                .describe("Salesforce object type to create (e.g., Account, Contact, Opportunity)"),
            fields: z
                .record(z.unknown())
                .describe("Field values as key-value pairs. Keys are Salesforce field API names."),
        }).strict(),
        annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            idempotentHint: false,
            openWorldHint: true,
        },
    }, async ({ object_type, fields }) => {
        if (isReadOnly) {
            return { isError: true, content: [{ type: "text", text: "❌ 읽기 전용 모드입니다. 레코드 생성 권한이 없습니다." }] };
        }
        try {
            const sf = getSalesforceClient();
            const result = await sf.createRecord(object_type, fields);
            const text = `Successfully created ${object_type}.\n- **ID**: ${result.id}\n- **Success**: ${result.success}`;
            return {
                content: [{ type: "text", text }],
                structuredContent: result,
            };
        }
        catch (error) {
            return {
                isError: true,
                content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
            };
        }
    });
    // Update Record
    server.registerTool("salesforce_update_record", {
        title: "Update Salesforce Record",
        description: `Update fields on an existing Salesforce record.

Args:
  - object_type (string): The Salesforce object type (e.g., 'Account', 'Contact')
  - record_id (string): The 15 or 18-character Salesforce record ID
  - fields (object): Key-value pairs of field API names and their new values

Returns:
  Confirmation message on success.

Notes:
  - Only the provided fields are updated; other fields remain unchanged.
  - To clear a field, set its value to null.

Examples:
  - Update account industry: object_type='Account', record_id='001xx...', fields={ "Industry": "Finance" }
  - Update opportunity stage: object_type='Opportunity', record_id='006xx...', fields={ "StageName": "Closed Won", "CloseDate": "2026-03-31" }`,
        inputSchema: z.object({
            object_type: z
                .string()
                .min(1)
                .describe("Salesforce object type (e.g., Account, Contact, Opportunity)"),
            record_id: z
                .string()
                .min(15)
                .max(18)
                .describe("15 or 18-character Salesforce record ID to update"),
            fields: z
                .record(z.unknown())
                .describe("Field values to update as key-value pairs. Only provided fields are modified."),
        }).strict(),
        annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true,
        },
    }, async ({ object_type, record_id, fields }) => {
        if (isReadOnly) {
            return { isError: true, content: [{ type: "text", text: "❌ 읽기 전용 모드입니다. 레코드 수정 권한이 없습니다." }] };
        }
        try {
            const sf = getSalesforceClient();
            await sf.updateRecord(object_type, record_id, fields);
            const updatedFields = Object.keys(fields).join(", ");
            const text = `Successfully updated ${object_type} (ID: ${record_id}).\nUpdated fields: ${updatedFields}`;
            return {
                content: [{ type: "text", text }],
                structuredContent: { success: true, id: record_id, updatedFields: Object.keys(fields) },
            };
        }
        catch (error) {
            return {
                isError: true,
                content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
            };
        }
    });
    // Delete Record
    server.registerTool("salesforce_delete_record", {
        title: "Delete Salesforce Record",
        description: `Permanently delete a Salesforce record. This action cannot be undone (record goes to Recycle Bin).

Args:
  - object_type (string): The Salesforce object type (e.g., 'Account', 'Lead')
  - record_id (string): The 15 or 18-character Salesforce record ID to delete

Returns:
  Confirmation message on success.

Warning: This operation moves the record to the Recycle Bin. It can be restored within 15 days.`,
        inputSchema: z.object({
            object_type: z
                .string()
                .min(1)
                .describe("Salesforce object type of the record to delete"),
            record_id: z
                .string()
                .min(15)
                .max(18)
                .describe("15 or 18-character Salesforce record ID to delete"),
        }).strict(),
        annotations: {
            readOnlyHint: false,
            destructiveHint: true,
            idempotentHint: false,
            openWorldHint: true,
        },
    }, async ({ object_type, record_id }) => {
        if (isReadOnly) {
            return { isError: true, content: [{ type: "text", text: "❌ 읽기 전용 모드입니다. 레코드 삭제 권한이 없습니다." }] };
        }
        try {
            const sf = getSalesforceClient();
            await sf.deleteRecord(object_type, record_id);
            const text = `Successfully deleted ${object_type} (ID: ${record_id}). The record is now in the Recycle Bin.`;
            return {
                content: [{ type: "text", text }],
                structuredContent: { success: true, id: record_id },
            };
        }
        catch (error) {
            return {
                isError: true,
                content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
            };
        }
    });
    // Upsert / bulk helper — list common object shortcuts
    void COMMON_OBJECTS;
    // Get Limits
    server.registerTool("salesforce_get_limits", {
        title: "Get Salesforce API Limits",
        description: `Check your Salesforce org's current API usage and remaining limits.

Returns:
  Key limits including:
  - DailyApiRequests: Daily REST API call quota (Max and Remaining)
  - DailyBulkApiRequests: Bulk API limits
  - Other org limits

Use this to monitor API consumption before running large batch operations.`,
        inputSchema: z.object({}).strict(),
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true,
        },
    }, async () => {
        try {
            const sf = getSalesforceClient();
            const limits = await sf.getLimits();
            const key = limits;
            const daily = key["DailyApiRequests"];
            const lines = ["# Salesforce API Limits", ""];
            if (daily) {
                const used = daily.Max - daily.Remaining;
                const pct = ((used / daily.Max) * 100).toFixed(1);
                lines.push(`## Daily API Requests`);
                lines.push(`- **Used**: ${used.toLocaleString()} / ${daily.Max.toLocaleString()} (${pct}%)`);
                lines.push(`- **Remaining**: ${daily.Remaining.toLocaleString()}`);
                lines.push("");
            }
            const notable = ["DailyBulkApiRequests", "DailyBulkV2QueryFileStorageMB", "DailyGenericStreamingApiEvents"];
            for (const name of notable) {
                const limit = key[name];
                if (limit) {
                    lines.push(`## ${name}`);
                    lines.push(`- Max: ${limit.Max.toLocaleString()} | Remaining: ${limit.Remaining.toLocaleString()}`);
                    lines.push("");
                }
            }
            return {
                content: [{ type: "text", text: lines.join("\n") }],
                structuredContent: limits,
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
//# sourceMappingURL=records.js.map