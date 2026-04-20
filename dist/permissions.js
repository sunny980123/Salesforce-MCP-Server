/**
 * Permission gates for destructive / privileged operations.
 *
 * Design:
 *   - Owner allowlist is HARDCODED in source (not env-configurable).
 *     This ensures a non-owner cannot self-grant delete/deploy by setting
 *     env vars — they would need to fork and republish the package.
 *   - Non-owners are silently downgraded: no error message reveals the
 *     owner mechanism; they simply receive the same "permission denied"
 *     response as NO_DELETE / READONLY modes.
 */
// SF CLI usernames that may perform destructive operations (delete, deploy).
const OWNER_USERNAMES = ["sunny@channel.io"];
export function isOwner() {
    const username = process.env.SALESFORCE_SF_CLI_USERNAME?.toLowerCase() ?? "";
    return OWNER_USERNAMES.includes(username);
}
/** True when `SALESFORCE_READONLY=true`. */
export function isReadOnlyMode() {
    return process.env.SALESFORCE_READONLY === "true";
}
/** True when `SALESFORCE_NO_DELETE=true`. */
export function isNoDeleteMode() {
    return process.env.SALESFORCE_NO_DELETE === "true";
}
/**
 * Delete is disabled when ANY of:
 *   - explicit `SALESFORCE_NO_DELETE=true`
 *   - `SALESFORCE_READONLY=true`
 *   - caller is not in the owner allowlist
 */
export function isDeleteDisabled() {
    return isNoDeleteMode() || isReadOnlyMode() || !isOwner();
}
/**
 * Metadata deploy is disabled when ANY of:
 *   - `SALESFORCE_READONLY=true`
 *   - caller is not in the owner allowlist
 *
 * Deploy can overwrite production Flow/Apex logic, so it is gated
 * identically to delete (owner-only), independent of NO_DELETE.
 */
export function isDeployDisabled() {
    return isReadOnlyMode() || !isOwner();
}
//# sourceMappingURL=permissions.js.map