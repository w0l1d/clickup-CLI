export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface PathParameter {
  name: string;
  required: boolean;
  in: 'path' | 'query' | 'header';
  schema?: { type?: string };
  description?: string;
}

export interface EndpointDef {
  method: HttpMethod;
  path: string;             // e.g. /v2/task/{task_id}
  operationId: string;
  summary: string;
  tags: string[];
  parameters: PathParameter[];
  hasRequestBody: boolean;
  apiVersion: 'v2' | 'v3';
}
