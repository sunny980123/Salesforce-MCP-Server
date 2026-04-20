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

// Tier 1: full access including delete. Hardcoded.
const OWNER_USERNAMES: readonly string[] = ["sunny@channel.io"];

// Tier 2: may deploy metadata (Flow/Apex/etc) but may NOT delete records.
// Owners are implicitly deployers — no need to list them here.
const DEPLOYER_USERNAMES: readonly string[] = [
  "east@channel.io",
  "wendy@channel.io",
  "aya@channel.io",
];

function getUsername(): string {
  return process.env.SALESFORCE_SF_CLI_USERNAME?.toLowerCase() ?? "";
}

export function isOwner(): boolean {
  return OWNER_USERNAMES.includes(getUsername());
}

/** Owner OR explicitly listed deployer. */
export function canDeploy(): boolean {
  const u = getUsername();
  return OWNER_USERNAMES.includes(u) || DEPLOYER_USERNAMES.includes(u);
}

/** True when `SALESFORCE_READONLY=true`. */
export function isReadOnlyMode(): boolean {
  return process.env.SALESFORCE_READONLY === "true";
}

/** True when `SALESFORCE_NO_DELETE=true`. */
export function isNoDeleteMode(): boolean {
  return process.env.SALESFORCE_NO_DELETE === "true";
}

/**
 * Delete is disabled when ANY of:
 *   - explicit `SALESFORCE_NO_DELETE=true`
 *   - `SALESFORCE_READONLY=true`
 *   - caller is not in the owner allowlist
 */
export function isDeleteDisabled(): boolean {
  return isNoDeleteMode() || isReadOnlyMode() || !isOwner();
}

/**
 * Metadata deploy is disabled when ANY of:
 *   - `SALESFORCE_READONLY=true`
 *   - caller is not in the owner or deployer allowlist
 *
 * Deploy can overwrite production Flow/Apex logic, so it is restricted
 * to an explicit allowlist (owners + named deployers). It is independent
 * of NO_DELETE — a deployer may still be in NO_DELETE mode.
 */
export function isDeployDisabled(): boolean {
  return isReadOnlyMode() || !canDeploy();
}
