export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type ApiVersion = 'v2' | 'v3';
export type ParamLocation = 'path' | 'query' | 'header' | 'cookie';

export interface ParamSchema {
  type?: string;
  format?: string;
  example?: unknown;
  default?: unknown;
  enum?: unknown[];
  items?: ParamSchema;
  properties?: Record<string, ParamSchema>;
  required?: string[];
  [k: string]: unknown;
}

export interface Param {
  name: string;
  in: ParamLocation;
  required: boolean;
  schema?: ParamSchema;
  example?: unknown;
  description?: string;
}

export interface BodyDef {
  contentType: string;
  schema?: ParamSchema;
  example?: unknown;
  required: boolean;
}

export interface ResponseDef {
  description?: string;
  contentType?: string;
  schema?: ParamSchema;
}

export interface SecurityScheme {
  type: string;
  scheme?: string;
  in?: string;
  name?: string;
  bearerFormat?: string;
  flows?: unknown;
  description?: string;
}

export type SecurityRequirement = Record<string, string[]>;

export interface Endpoint {
  method: HttpMethod;
  path: string;
  operationId: string;
  summary: string;
  description: string;
  tags: string[];
  parameters: Param[];
  requestBody?: BodyDef;
  responses: Record<string, ResponseDef>;
  serverUrl: string;
  apiVersion: ApiVersion;
}

export interface SpecDoc {
  version: ApiVersion;
  servers: string[];
  security: SecurityRequirement[];
  securitySchemes: Record<string, SecurityScheme>;
  endpoints: Endpoint[];
}
