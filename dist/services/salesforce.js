import axios, { AxiosError } from "axios";
import { SF_API_VERSION, SF_LOGIN_URL } from "../constants.js";
class SalesforceClient {
    accessToken = null;
    instanceUrl = null;
    client;
    credentials;
    constructor(credentials) {
        this.credentials = credentials;
        this.client = axios.create({ timeout: 30000 });
        // Direct token injection: skip OAuth if access token is provided
        if (credentials.accessToken && credentials.instanceUrl) {
            this.accessToken = credentials.accessToken;
            this.instanceUrl = credentials.instanceUrl;
        }
    }
    async authenticate() {
        if (!this.credentials.clientId || !this.credentials.clientSecret ||
            !this.credentials.username || !this.credentials.password) {
            throw new Error("Missing OAuth credentials. Provide either SALESFORCE_ACCESS_TOKEN + SALESFORCE_INSTANCE_URL, " +
                "or SALESFORCE_CLIENT_ID + SALESFORCE_CLIENT_SECRET + SALESFORCE_USERNAME + SALESFORCE_PASSWORD.");
        }
        const params = new URLSearchParams({
            grant_type: "password",
            client_id: this.credentials.clientId,
            client_secret: this.credentials.clientSecret,
            username: this.credentials.username,
            password: this.credentials.password,
        });
        const response = await this.client.post(`${SF_LOGIN_URL}/services/oauth2/token`, params.toString(), { headers: { "Content-Type": "application/x-www-form-urlencoded" } });
        this.accessToken = response.data.access_token;
        this.instanceUrl = response.data.instance_url;
    }
    async ensureAuth() {
        if (!this.accessToken || !this.instanceUrl) {
            await this.authenticate();
        }
    }
    authHeaders() {
        return {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
            Accept: "application/json",
        };
    }
    baseUrl() {
        return `${this.instanceUrl}/services/data/${SF_API_VERSION}`;
    }
    async query(soql) {
        await this.ensureAuth();
        try {
            const response = await this.client.get(`${this.baseUrl()}/query`, {
                params: { q: soql },
                headers: this.authHeaders(),
            });
            return response.data;
        }
        catch (error) {
            throw wrapError(error);
        }
    }
    async queryMore(nextUrl) {
        await this.ensureAuth();
        try {
            const response = await this.client.get(`${this.instanceUrl}${nextUrl}`, { headers: this.authHeaders() });
            return response.data;
        }
        catch (error) {
            throw wrapError(error);
        }
    }
    async search(sosl) {
        await this.ensureAuth();
        try {
            const response = await this.client.get(`${this.baseUrl()}/search`, {
                params: { q: sosl },
                headers: this.authHeaders(),
            });
            return response.data;
        }
        catch (error) {
            throw wrapError(error);
        }
    }
    async getRecord(objectType, id, fields) {
        await this.ensureAuth();
        try {
            const params = {};
            if (fields?.length) {
                params.fields = fields.join(",");
            }
            const response = await this.client.get(`${this.baseUrl()}/sobjects/${objectType}/${id}`, { params, headers: this.authHeaders() });
            return response.data;
        }
        catch (error) {
            throw wrapError(error);
        }
    }
    async createRecord(objectType, data) {
        await this.ensureAuth();
        try {
            const response = await this.client.post(`${this.baseUrl()}/sobjects/${objectType}`, data, { headers: this.authHeaders() });
            return response.data;
        }
        catch (error) {
            throw wrapError(error);
        }
    }
    async updateRecord(objectType, id, data) {
        await this.ensureAuth();
        try {
            await this.client.patch(`${this.baseUrl()}/sobjects/${objectType}/${id}`, data, { headers: this.authHeaders() });
        }
        catch (error) {
            throw wrapError(error);
        }
    }
    async deleteRecord(objectType, id) {
        await this.ensureAuth();
        try {
            await this.client.delete(`${this.baseUrl()}/sobjects/${objectType}/${id}`, { headers: this.authHeaders() });
        }
        catch (error) {
            throw wrapError(error);
        }
    }
    async describeObject(objectType) {
        await this.ensureAuth();
        try {
            const response = await this.client.get(`${this.baseUrl()}/sobjects/${objectType}/describe`, { headers: this.authHeaders() });
            return response.data;
        }
        catch (error) {
            throw wrapError(error);
        }
    }
    async listObjects() {
        await this.ensureAuth();
        try {
            const response = await this.client.get(`${this.baseUrl()}/sobjects`, { headers: this.authHeaders() });
            return response.data.sobjects;
        }
        catch (error) {
            throw wrapError(error);
        }
    }
    async getLimits() {
        await this.ensureAuth();
        try {
            const response = await this.client.get(`${this.baseUrl()}/limits`, { headers: this.authHeaders() });
            return response.data;
        }
        catch (error) {
            throw wrapError(error);
        }
    }
    toolingBaseUrl() {
        return `${this.instanceUrl}/services/data/${SF_API_VERSION}/tooling`;
    }
    async toolingQuery(soql) {
        await this.ensureAuth();
        try {
            const response = await this.client.get(`${this.toolingBaseUrl()}/query`, {
                params: { q: soql },
                headers: this.authHeaders(),
            });
            return response.data;
        }
        catch (error) {
            throw wrapError(error);
        }
    }
}
function wrapError(error) {
    if (error instanceof AxiosError && error.response) {
        const status = error.response.status;
        const sfErrors = error.response.data;
        const msg = Array.isArray(sfErrors) && sfErrors[0]?.message
            ? sfErrors[0].message
            : JSON.stringify(sfErrors);
        switch (status) {
            case 400:
                return new Error(`Bad request: ${msg}. Check field names, required fields, or data types.`);
            case 401:
                return new Error("Authentication failed. Check your credentials or re-authenticate.");
            case 403:
                return new Error(`Permission denied: ${msg}. Verify the connected app scopes and user permissions.`);
            case 404:
                return new Error(`Not found: ${msg}. Check the record ID or object type.`);
            case 429:
                return new Error("Rate limit exceeded. Wait before making more requests or check daily API limits.");
            default:
                return new Error(`Salesforce API error (${status}): ${msg}`);
        }
    }
    if (error instanceof Error)
        return error;
    return new Error(String(error));
}
// Singleton client instance
let sfClient = null;
export function getSalesforceClient() {
    if (!sfClient) {
        const accessToken = process.env.SALESFORCE_ACCESS_TOKEN;
        const instanceUrl = process.env.SALESFORCE_INSTANCE_URL;
        if (accessToken && instanceUrl) {
            sfClient = new SalesforceClient({ accessToken, instanceUrl });
        }
        else {
            const clientId = process.env.SALESFORCE_CLIENT_ID;
            const clientSecret = process.env.SALESFORCE_CLIENT_SECRET;
            const username = process.env.SALESFORCE_USERNAME;
            const password = process.env.SALESFORCE_PASSWORD;
            if (!clientId || !clientSecret || !username || !password) {
                throw new Error("Missing required environment variables. Provide either:\n" +
                    "  Option 1: SALESFORCE_ACCESS_TOKEN + SALESFORCE_INSTANCE_URL\n" +
                    "  Option 2: SALESFORCE_CLIENT_ID + SALESFORCE_CLIENT_SECRET + SALESFORCE_USERNAME + SALESFORCE_PASSWORD");
            }
            sfClient = new SalesforceClient({ clientId, clientSecret, username, password });
        }
    }
    return sfClient;
}
//# sourceMappingURL=salesforce.js.map