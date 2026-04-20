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
export declare function isOwner(): boolean;
/** True when `SALESFORCE_READONLY=true`. */
export declare function isReadOnlyMode(): boolean;
/** True when `SALESFORCE_NO_DELETE=true`. */
export declare function isNoDeleteMode(): boolean;
/**
 * Delete is disabled when ANY of:
 *   - explicit `SALESFORCE_NO_DELETE=true`
 *   - `SALESFORCE_READONLY=true`
 *   - caller is not in the owner allowlist
 */
export declare function isDeleteDisabled(): boolean;
/**
 * Metadata deploy is disabled when ANY of:
 *   - `SALESFORCE_READONLY=true`
 *   - caller is not in the owner allowlist
 *
 * Deploy can overwrite production Flow/Apex logic, so it is gated
 * identically to delete (owner-only), independent of NO_DELETE.
 */
export declare function isDeployDisabled(): boolean;
//# sourceMappingURL=permissions.d.ts.map