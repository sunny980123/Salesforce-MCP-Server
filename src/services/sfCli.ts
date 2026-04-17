import { execSync } from "child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  readFileSync,
  existsSync,
} from "fs";
import { tmpdir } from "os";
import { dirname, join } from "path";
import { SF_API_VERSION } from "../constants.js";

export type MetadataType =
  | "Flow"
  | "ApexClass"
  | "ApexTrigger"
  | "ValidationRule"
  | "PermissionSet"
  | "Layout"
  | "CustomObject";

export const SUPPORTED_METADATA_TYPES: readonly MetadataType[] = [
  "Flow",
  "ApexClass",
  "ApexTrigger",
  "ValidationRule",
  "PermissionSet",
  "Layout",
  "CustomObject",
] as const;

export interface MetadataPaths {
  /** Path relative to force-app/main/default/ for the *-meta.xml file */
  xmlPath: string;
  /** Optional body file path (ApexClass .cls / ApexTrigger .trigger) */
  bodyPath?: string;
}

/**
 * Resolve the SFDX source-format paths for a given metadata component.
 */
export function resolveMetadataPaths(
  type: MetadataType,
  apiName: string,
  objectName?: string
): MetadataPaths {
  switch (type) {
    case "Flow":
      return { xmlPath: `flows/${apiName}.flow-meta.xml` };
    case "ApexClass":
      return {
        xmlPath: `classes/${apiName}.cls-meta.xml`,
        bodyPath: `classes/${apiName}.cls`,
      };
    case "ApexTrigger":
      return {
        xmlPath: `triggers/${apiName}.trigger-meta.xml`,
        bodyPath: `triggers/${apiName}.trigger`,
      };
    case "ValidationRule":
      if (!objectName) {
        throw new Error(
          "object_name is required for ValidationRule (parent sObject API name)."
        );
      }
      return {
        xmlPath: `objects/${objectName}/validationRules/${apiName}.validationRule-meta.xml`,
      };
    case "PermissionSet":
      return {
        xmlPath: `permissionsets/${apiName}.permissionset-meta.xml`,
      };
    case "Layout":
      return { xmlPath: `layouts/${apiName}.layout-meta.xml` };
    case "CustomObject":
      return { xmlPath: `objects/${apiName}/${apiName}.object-meta.xml` };
  }
}

/**
 * Create a minimal SFDX project in a temp directory so `sf project deploy/retrieve`
 * can operate on source-format files.
 */
export function createTempSfdxProject(): string {
  const dir = mkdtempSync(join(tmpdir(), "sfmcp-"));
  const apiVersion = SF_API_VERSION.replace(/^v/, "");
  const sfdxProject = {
    packageDirectories: [{ path: "force-app", default: true }],
    namespace: "",
    sfdcLoginUrl: "https://login.salesforce.com",
    sourceApiVersion: apiVersion,
  };
  writeFileSync(
    join(dir, "sfdx-project.json"),
    JSON.stringify(sfdxProject, null, 2)
  );
  mkdirSync(join(dir, "force-app", "main", "default"), { recursive: true });
  return dir;
}

/**
 * Write metadata files into the SFDX project source tree.
 */
export function writeMetadataFiles(
  projectDir: string,
  paths: MetadataPaths,
  xmlContent: string,
  bodyContent?: string
): void {
  const base = join(projectDir, "force-app", "main", "default");
  const xmlFull = join(base, paths.xmlPath);
  mkdirSync(dirname(xmlFull), { recursive: true });
  writeFileSync(xmlFull, xmlContent);

  if (paths.bodyPath) {
    if (bodyContent === undefined) {
      throw new Error(
        `body_content is required for this metadata type (expected ${paths.bodyPath}).`
      );
    }
    const bodyFull = join(base, paths.bodyPath);
    mkdirSync(dirname(bodyFull), { recursive: true });
    writeFileSync(bodyFull, bodyContent);
  }
}

/**
 * Read a retrieved metadata component's files back from disk.
 */
export function readRetrievedFiles(
  projectDir: string,
  paths: MetadataPaths
): { xml: string; body?: string } {
  const base = join(projectDir, "force-app", "main", "default");
  const xmlFull = join(base, paths.xmlPath);
  if (!existsSync(xmlFull)) {
    throw new Error(
      `Retrieved file not found at ${paths.xmlPath}. The component may not exist in the org, or retrieval returned nothing.`
    );
  }
  const xml = readFileSync(xmlFull, "utf-8");
  let body: string | undefined;
  if (paths.bodyPath) {
    const bodyFull = join(base, paths.bodyPath);
    if (existsSync(bodyFull)) {
      body = readFileSync(bodyFull, "utf-8");
    }
  }
  return { xml, body };
}

/** Best-effort cleanup of a temp SFDX project. */
export function cleanupProject(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // swallow — temp dir will be cleaned up by OS eventually
  }
}

/**
 * Run a `sf` CLI command expecting JSON output. Handles the case where `sf`
 * exits non-zero (e.g. deploy failure) but still prints a valid JSON payload
 * to stdout.
 */
export function runSfJson(
  args: string[],
  options: { cwd?: string; timeoutMs?: number } = {}
): unknown {
  const fullArgs = [...args, "--json"];
  const cmd = ["sf", ...fullArgs].join(" ");
  try {
    const out = execSync(cmd, {
      encoding: "utf-8",
      cwd: options.cwd,
      timeout: options.timeoutMs ?? 300_000,
      maxBuffer: 20 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return parseJsonFromOutput(out);
  } catch (error) {
    // sf CLI may return exit code != 0 but still emit a JSON error payload
    if (
      error &&
      typeof error === "object" &&
      "stdout" in error &&
      (error as { stdout?: unknown }).stdout
    ) {
      const stdout = (error as { stdout: Buffer | string }).stdout;
      const text =
        typeof stdout === "string" ? stdout : Buffer.from(stdout).toString("utf-8");
      try {
        return parseJsonFromOutput(text);
      } catch {
        // fall through
      }
    }
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`sf CLI command failed: ${cmd}\n${msg}`);
  }
}

function parseJsonFromOutput(out: string): unknown {
  const jsonStart = out.indexOf("{");
  if (jsonStart < 0) {
    throw new Error(`No JSON payload in sf output: ${out.slice(0, 500)}`);
  }
  return JSON.parse(out.slice(jsonStart));
}
