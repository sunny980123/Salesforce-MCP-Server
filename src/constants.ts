export const SF_API_VERSION = process.env.SALESFORCE_API_VERSION ?? "v59.0";
export const CHARACTER_LIMIT = 25000;

export const SF_LOGIN_URL =
  process.env.SALESFORCE_LOGIN_URL ?? "https://login.salesforce.com";

export enum ResponseFormat {
  MARKDOWN = "markdown",
  JSON = "json",
}
