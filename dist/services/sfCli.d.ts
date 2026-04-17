export type MetadataType = "Flow" | "ApexClass" | "ApexTrigger" | "ValidationRule" | "PermissionSet" | "Layout" | "CustomObject";
export declare const SUPPORTED_METADATA_TYPES: readonly MetadataType[];
export interface MetadataPaths {
    /** Path relative to force-app/main/default/ for the *-meta.xml file */
    xmlPath: string;
    /** Optional body file path (ApexClass .cls / ApexTrigger .trigger) */
    bodyPath?: string;
}
/**
 * Resolve the SFDX source-format paths for a given metadata component.
 */
export declare function resolveMetadataPaths(type: MetadataType, apiName: string, objectName?: string): MetadataPaths;
/**
 * Create a minimal SFDX project in a temp directory so `sf project deploy/retrieve`
 * can operate on source-format files.
 */
export declare function createTempSfdxProject(): string;
/**
 * Write metadata files into the SFDX project source tree.
 */
export declare function writeMetadataFiles(projectDir: string, paths: MetadataPaths, xmlContent: string, bodyContent?: string): void;
/**
 * Read a retrieved metadata component's files back from disk.
 */
export declare function readRetrievedFiles(projectDir: string, paths: MetadataPaths): {
    xml: string;
    body?: string;
};
/** Best-effort cleanup of a temp SFDX project. */
export declare function cleanupProject(dir: string): void;
/**
 * Run a `sf` CLI command expecting JSON output. Handles the case where `sf`
 * exits non-zero (e.g. deploy failure) but still prints a valid JSON payload
 * to stdout.
 */
export declare function runSfJson(args: string[], options?: {
    cwd?: string;
    timeoutMs?: number;
}): unknown;
//# sourceMappingURL=sfCli.d.ts.map