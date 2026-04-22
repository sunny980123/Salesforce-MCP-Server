import type { ObjectDescribe, QueryResult, SalesforceRecord, SaveResult, SObjectInfo } from "../types.js";
interface SalesforceCredentials {
    clientId?: string;
    clientSecret?: string;
    username?: string;
    password?: string;
    accessToken?: string;
    instanceUrl?: string;
    privateKeyPath?: string;
    sfCliUsername?: string;
}
declare class SalesforceClient {
    private accessToken;
    private instanceUrl;
    private tokenExpiresAt;
    private client;
    private credentials;
    constructor(credentials: SalesforceCredentials);
    /**
     * Invalidate the cached token so the next ensureAuth() call
     * will trigger a fresh authentication.
     */
    invalidateToken(): void;
    /**
     * Wrapper that executes an API call and, on auth-related errors
     * (401 or 400 with session/auth messages), invalidates the token,
     * re-authenticates, and retries once.
     */
    private withAuthRetry;
    private authenticateJwt;
    private authenticateSfCli;
    authenticate(): Promise<void>;
    private ensureAuth;
    private authHeaders;
    private baseUrl;
    query<T = SalesforceRecord>(soql: string): Promise<QueryResult<T>>;
    queryMore<T = SalesforceRecord>(nextUrl: string): Promise<QueryResult<T>>;
    search(sosl: string): Promise<{
        searchRecords: SalesforceRecord[];
    }>;
    getRecord(objectType: string, id: string, fields?: string[]): Promise<SalesforceRecord>;
    createRecord(objectType: string, data: Record<string, unknown>): Promise<SaveResult>;
    updateRecord(objectType: string, id: string, data: Record<string, unknown>): Promise<void>;
    deleteRecord(objectType: string, id: string): Promise<void>;
    describeObject(objectType: string): Promise<ObjectDescribe>;
    listObjects(): Promise<SObjectInfo[]>;
    getLimits(): Promise<Record<string, {
        Max: number;
        Remaining: number;
    }>>;
    private toolingBaseUrl;
    toolingQuery<T = SalesforceRecord>(soql: string): Promise<QueryResult<T>>;
    /**
     * Create a Tooling API sobject (used for SandboxInfo and similar metadata objects).
     */
    toolingCreate(objectType: string, data: Record<string, unknown>): Promise<SaveResult>;
}
/**
 * Reset the singleton client, forcing a fresh instance and re-authentication
 * on the next getSalesforceClient() call.
 */
export declare function resetSalesforceClient(): void;
export declare function getSalesforceClient(): SalesforceClient;
export {};
//# sourceMappingURL=salesforce.d.ts.map