import { createSign } from "crypto";
import { readFileSync } from "fs";
import { execSync } from "child_process";
import axios, { AxiosError } from "axios";
import { SF_API_VERSION, SF_LOGIN_URL } from "../constants.js";
class SalesforceClient {
    accessToken = null;
    instanceUrl = null;
    tokenExpiresAt = 0;
    client;
    credentials;
    constructor(credentials) {
        this.credentials = credentials;
        this.client = axios.create({ timeout: 30000 });
        // Direct token injection: skip OAuth if access token is provided
        if (credentials.accessToken && credentials.instanceUrl) {
            this.accessToken = credentials.accessToken;
            this.instanceUrl = credentials.instanceUrl;
            // Static token: treat as non-expiring (user manages rotation manually)
            this.tokenExpiresAt = Infinity;
        }
    }
    /**
     * Invalidate the cached token so the next ensureAuth() call
     * will trigger a fresh authentication.
     */
    invalidateToken() {
        this.accessToken = null;
        this.tokenExpiresAt = 0;
        console.error("Salesforce token invalidated; will re-authenticate on next call.");
    }
    /**
     * Wrapper that executes an API call and, on auth-related errors
     * (401 or 400 with session/auth messages), invalidates the token,
     * re-authenticates, and retries once.
     */
    async withAuthRetry(fn) {
        try {
            return await fn();
        }
        catch (error) {
            if (error instanceof AxiosError && error.response) {
                const status = error.response.status;
                const body = error.response.data;
                const msg = Array.isArray(body) && body[0]?.message
                    ? body[0].message
                    : typeof body === "string" ? body : JSON.stringify(body);
                const isAuthError = status === 401 ||
                    (status === 400 && /session|auth|token|expired|invalid/i.test(msg));
                if (isAuthError) {
                    console.error(`Auth-related ${status} error detected, re-authenticating...`);
                    this.invalidateToken();
                    await this.ensureAuth();
                    // Retry once after re-authentication
                    return await fn();
                }
            }
            throw error;
        }
    }
    async authenticateJwt() {
        const { clientId, username, privateKeyPath, instanceUrl } = this.credentials;
        if (!clientId || !username || !privateKeyPath || !instanceUrl) {
            throw new Error("Missing JWT credentials. Provide SALESFORCE_CLIENT_ID, SALESFORCE_USERNAME, " +
                "SALESFORCE_INSTANCE_URL, and SALESFORCE_PRIVATE_KEY_PATH.");
        }
        const privateKey = readFileSync(privateKeyPath);
        const now = Math.floor(Date.now() / 1000);
        const header = Buffer.from(JSON.stringify({ alg: "RS256" })).toString("base64url");
        const payload = Buffer.from(JSON.stringify({
            iss: clientId,
            sub: username,
            aud: SF_LOGIN_URL,
            exp: now + 300,
        })).toString("base64url");
        const sign = createSign("RSA-SHA256");
        sign.update(`${header}.${payload}`);
        const signature = sign.sign(privateKey, "base64url");
        const jwt = `${header}.${payload}.${signature}`;
        const params = new URLSearchParams({
            grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
            assertion: jwt,
        });
        const response = await this.client.post(`${SF_LOGIN_URL}/services/oauth2/token`, params.toString(), { headers: { "Content-Type": "application/x-www-form-urlencoded" } });
        this.accessToken = response.data.access_token;
        this.instanceUrl = response.data.instance_url ?? instanceUrl;
        // Salesforce JWT access tokens are valid for 1 hour; refresh 5 min early
        this.tokenExpiresAt = Date.now() + 55 * 60 * 1000;
        console.error("Salesforce JWT token refreshed successfully.");
    }
    authenticateSfCli() {
        const username = this.credentials.sfCliUsername;
        try {
            const result = execSync(`sf org display --target-org ${username} --json 2>/dev/null`, { encoding: "utf-8" });
            // SF CLI may prefix warnings before the JSON — extract only the JSON part
            const jsonStart = result.indexOf("{");
            const jsonStr = jsonStart >= 0 ? result.slice(jsonStart) : result;
            const data = JSON.parse(jsonStr);
            if (!data.result?.accessToken || !data.result?.instanceUrl) {
                throw new Error(`SF CLI returned incomplete data for ${username}. ` +
                    `accessToken: ${!!data.result?.accessToken}, instanceUrl: ${!!data.result?.instanceUrl}. ` +
                    "Run 'sf org login web --instance-url <url>' to re-authenticate.");
            }
            this.accessToken = data.result.accessToken;
            this.instanceUrl = data.result.instanceUrl;
            this.tokenExpiresAt = Date.now() + 55 * 60 * 1000;
            console.error("Salesforce token refreshed via SF CLI.");
        }
        catch (error) {
            if (error instanceof Error && error.message.includes("SF CLI returned")) {
                throw error; // Re-throw our own validation error
            }
            throw new Error(`SF CLI authentication failed for ${username}: ${error instanceof Error ? error.message : String(error)}. ` +
                "Ensure 'sf' CLI is installed, on PATH, and the org is authorized.");
        }
    }
    async authenticate() {
        // SF CLI Flow (Option 4)
        if (this.credentials.sfCliUsername) {
            this.authenticateSfCli();
            return;
        }
        // JWT Bearer Flow (preferred)
        if (this.credentials.privateKeyPath) {
            await this.authenticateJwt();
            return;
        }
        // Username/Password Flow (fallback)
        if (!this.credentials.clientId || !this.credentials.clientSecret ||
            !this.credentials.username || !this.credentials.password) {
            throw new Error("Missing OAuth credentials. Provide either SALESFORCE_ACCESS_TOKEN + SALESFORCE_INSTANCE_URL, " +
                "SALESFORCE_CLIENT_ID + SALESFORCE_USERNAME + SALESFORCE_PRIVATE_KEY_PATH (JWT Bearer), " +
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
        this.tokenExpiresAt = Infinity; // Password flow tokens don't have a fixed expiry
    }
    async ensureAuth() {
        const isExpired = Date.now() >= this.tokenExpiresAt;
        if (!this.accessToken || !this.instanceUrl || isExpired) {
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
            return await this.withAuthRetry(async () => {
                const response = await this.client.get(`${this.baseUrl()}/query`, {
                    params: { q: soql },
                    headers: this.authHeaders(),
                });
                return response.data;
            });
        }
        catch (error) {
            throw wrapError(error);
        }
    }
    async queryMore(nextUrl) {
        await this.ensureAuth();
        try {
            return await this.withAuthRetry(async () => {
                const response = await this.client.get(`${this.instanceUrl}${nextUrl}`, { headers: this.authHeaders() });
                return response.data;
            });
        }
        catch (error) {
            throw wrapError(error);
        }
    }
    async search(sosl) {
        await this.ensureAuth();
        try {
            return await this.withAuthRetry(async () => {
                const response = await this.client.get(`${this.baseUrl()}/search`, {
                    params: { q: sosl },
                    headers: this.authHeaders(),
                });
                return response.data;
            });
        }
        catch (error) {
            throw wrapError(error);
        }
    }
    async getRecord(objectType, id, fields) {
        await this.ensureAuth();
        try {
            return await this.withAuthRetry(async () => {
                const params = {};
                if (fields?.length) {
                    params.fields = fields.join(",");
                }
                const response = await this.client.get(`${this.baseUrl()}/sobjects/${objectType}/${id}`, { params, headers: this.authHeaders() });
                return response.data;
            });
        }
        catch (error) {
            throw wrapError(error);
        }
    }
    async createRecord(objectType, data) {
        await this.ensureAuth();
        try {
            return await this.withAuthRetry(async () => {
                const response = await this.client.post(`${this.baseUrl()}/sobjects/${objectType}`, data, { headers: this.authHeaders() });
                return response.data;
            });
        }
        catch (error) {
            throw wrapError(error);
        }
    }
    async updateRecord(objectType, id, data) {
        await this.ensureAuth();
        try {
            await this.withAuthRetry(async () => {
                await this.client.patch(`${this.baseUrl()}/sobjects/${objectType}/${id}`, data, { headers: this.authHeaders() });
            });
        }
        catch (error) {
            throw wrapError(error);
        }
    }
    async deleteRecord(objectType, id) {
        await this.ensureAuth();
        try {
            await this.withAuthRetry(async () => {
                await this.client.delete(`${this.baseUrl()}/sobjects/${objectType}/${id}`, { headers: this.authHeaders() });
            });
        }
        catch (error) {
            throw wrapError(error);
        }
    }
    async describeObject(objectType) {
        await this.ensureAuth();
        try {
            return await this.withAuthRetry(async () => {
                const response = await this.client.get(`${this.baseUrl()}/sobjects/${objectType}/describe`, { headers: this.authHeaders() });
                return response.data;
            });
        }
        catch (error) {
            throw wrapError(error);
        }
    }
    async listObjects() {
        await this.ensureAuth();
        try {
            return await this.withAuthRetry(async () => {
                const response = await this.client.get(`${this.baseUrl()}/sobjects`, { headers: this.authHeaders() });
                return response.data.sobjects;
            });
        }
        catch (error) {
            throw wrapError(error);
        }
    }
    async getLimits() {
        await this.ensureAuth();
        try {
            return await this.withAuthRetry(async () => {
                const response = await this.client.get(`${this.baseUrl()}/limits`, { headers: this.authHeaders() });
                return response.data;
            });
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
            return await this.withAuthRetry(async () => {
                const response = await this.client.get(`${this.toolingBaseUrl()}/query`, {
                    params: { q: soql },
                    headers: this.authHeaders(),
                });
                return response.data;
            });
        }
        catch (error) {
            throw wrapError(error);
        }
    }
    /**
     * Create a Tooling API sobject (used for SandboxInfo and similar metadata objects).
     */
    async toolingCreate(objectType, data) {
        await this.ensureAuth();
        try {
            return await this.withAuthRetry(async () => {
                const response = await this.client.post(`${this.toolingBaseUrl()}/sobjects/${objectType}`, data, { headers: this.authHeaders() });
                return response.data;
            });
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
/**
 * Reset the singleton client, forcing a fresh instance and re-authentication
 * on the next getSalesforceClient() call.
 */
export function resetSalesforceClient() {
    sfClient = null;
    console.error("Salesforce client singleton has been reset.");
}
export function getSalesforceClient() {
    if (!sfClient) {
        const accessToken = process.env.SALESFORCE_ACCESS_TOKEN;
        const instanceUrl = process.env.SALESFORCE_INSTANCE_URL;
        const clientId = process.env.SALESFORCE_CLIENT_ID;
        const username = process.env.SALESFORCE_USERNAME;
        const privateKeyPath = process.env.SALESFORCE_PRIVATE_KEY_PATH;
        const sfCliUsername = process.env.SALESFORCE_SF_CLI_USERNAME;
        if (sfCliUsername) {
            // Option 4: SF CLI (auto-refreshes via stored refresh token)
            sfClient = new SalesforceClient({ sfCliUsername });
        }
        else if (accessToken && instanceUrl) {
            // Option 1: Static Access Token (manual rotation required)
            sfClient = new SalesforceClient({ accessToken, instanceUrl });
        }
        else if (clientId && username && privateKeyPath && instanceUrl) {
            // Option 2: JWT Bearer Flow (auto-refreshes every hour)
            sfClient = new SalesforceClient({ clientId, username, privateKeyPath, instanceUrl });
        }
        else {
            const clientSecret = process.env.SALESFORCE_CLIENT_SECRET;
            const password = process.env.SALESFORCE_PASSWORD;
            if (!clientId || !clientSecret || !username || !password) {
                throw new Error("Missing required environment variables. Provide one of:\n" +
                    "  Option 4 (SF CLI):         SALESFORCE_SF_CLI_USERNAME=user@example.com\n" +
                    "  Option 1 (Static Token):   SALESFORCE_ACCESS_TOKEN + SALESFORCE_INSTANCE_URL\n" +
                    "  Option 2 (JWT Bearer):     SALESFORCE_CLIENT_ID + SALESFORCE_USERNAME + SALESFORCE_INSTANCE_URL + SALESFORCE_PRIVATE_KEY_PATH\n" +
                    "  Option 3 (Password OAuth): SALESFORCE_CLIENT_ID + SALESFORCE_CLIENT_SECRET + SALESFORCE_USERNAME + SALESFORCE_PASSWORD");
            }
            // Option 3: Username/Password OAuth Flow
            sfClient = new SalesforceClient({ clientId, clientSecret, username, password });
        }
    }
    return sfClient;
}
//# sourceMappingURL=salesforce.js.map