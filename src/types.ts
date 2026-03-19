export interface SalesforceRecord {
  Id: string;
  [key: string]: unknown;
}

export interface QueryResult<T = SalesforceRecord> {
  totalSize: number;
  done: boolean;
  records: T[];
  nextRecordsUrl?: string;
}

export interface SaveResult {
  id: string;
  success: boolean;
  errors: unknown[];
  [key: string]: unknown;
}

export interface FieldDescribe {
  name: string;
  label: string;
  type: string;
  length?: number;
  required?: boolean;
  nillable?: boolean;
  createable?: boolean;
  updateable?: boolean;
  picklistValues?: Array<{ value: string; label: string; active: boolean }>;
}

export interface ObjectDescribe {
  name: string;
  label: string;
  labelPlural: string;
  queryable: boolean;
  createable: boolean;
  updateable: boolean;
  deletable: boolean;
  fields: FieldDescribe[];
}

export interface SObjectInfo {
  name: string;
  label: string;
  labelPlural: string;
  queryable: boolean;
  createable: boolean;
  updateable: boolean;
  deletable: boolean;
  urls: { sobject: string };
}

export interface TokenResponse {
  access_token: string;
  instance_url: string;
  token_type: string;
}
