import SwaggerParser from '@apidevtools/swagger-parser';
import yaml from 'js-yaml';
import { EndpointDef, HttpMethod, PathParameter } from '../models/endpoint';
import { OpenAPI } from 'openapi-types';

const VALID_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

function extractEndpoints(api: OpenAPI.Document, apiVersion: 'v2' | 'v3'): EndpointDef[] {
  const endpoints: EndpointDef[] = [];
  const paths = (api as any).paths || {};

  for (const [rawPath, pathItem] of Object.entries(paths)) {
    if (!pathItem) continue;
    for (const method of VALID_METHODS) {
      const op = (pathItem as any)[method.toLowerCase()];
      if (!op) continue;

      // Merge path-level and operation-level parameters
      const pathParams: PathParameter[] = ((pathItem as any).parameters || []).map((p: any) => ({
        name: p.name,
        required: p.required ?? (p.in === 'path'),
        in: p.in,
        schema: p.schema,
        description: p.description,
      }));
      const opParams: PathParameter[] = (op.parameters || []).map((p: any) => ({
        name: p.name,
        required: p.required ?? (p.in === 'path'),
        in: p.in,
        schema: p.schema,
        description: p.description,
      }));
      // Operation params override path params
      const paramMap = new Map<string, PathParameter>();
      [...pathParams, ...opParams].forEach(p => paramMap.set(p.name, p));

      const endpoint: EndpointDef = {
        method,
        path: rawPath,
        operationId: op.operationId || `${method.toLowerCase()}${rawPath.replace(/[^a-zA-Z0-9]/g, '_')}`,
        summary: op.summary || '',
        tags: op.tags || [],
        parameters: Array.from(paramMap.values()),
        hasRequestBody: !!op.requestBody,
        apiVersion,
      };
      endpoints.push(endpoint);
    }
  }
  return endpoints;
}

export async function parseSpecs(v2Content: string, v3Content: string): Promise<EndpointDef[]> {
  // Parse v2 JSON
  const v2Json = JSON.parse(v2Content);
  const v2Api = await SwaggerParser.dereference(v2Json as any) as OpenAPI.Document;
  const v2Endpoints = extractEndpoints(v2Api, 'v2');

  // Parse v3 YAML
  const v3Json = yaml.load(v3Content);
  const v3Api = await SwaggerParser.dereference(v3Json as any) as OpenAPI.Document;
  const v3Endpoints = extractEndpoints(v3Api, 'v3');

  return [...v2Endpoints, ...v3Endpoints];
}
