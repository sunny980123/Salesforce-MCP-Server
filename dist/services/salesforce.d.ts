import type { ObjectDescribe, QueryResult, SalesforceRecord, SaveResult, SObjectInfo } from "../types.js";
interface SalesforceCredentials {
    clientId?: string;
    clientSecret?: string;
    username?: string;
    password?: string;
    accessToken?: string;
    instanceUrl?: string;
}
declare class SalesforceClient {
    private accessToken;
    private instanceUrl;
    private client;
    private credentials;
    constructor(credentials: SalesforceCredentials);
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
}
export declare function getSalesforceClient(): SalesforceClient;
export {};
//# sourceMappingURL=salesforce.d.ts.map