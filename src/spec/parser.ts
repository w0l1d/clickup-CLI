import SwaggerParser from '@apidevtools/swagger-parser';
import yaml from 'js-yaml';
import {
  ApiVersion,
  BodyDef,
  Endpoint,
  HttpMethod,
  Param,
  ResponseDef,
  SecurityRequirement,
  SecurityScheme,
  SpecDoc,
} from './model';

const VALID_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

const DEFAULT_SERVERS: Record<ApiVersion, string> = {
  v2: 'https://api.clickup.com/api/v2',
  v3: 'https://api.clickup.com/api/v3',
};

function extractServers(api: any, version: ApiVersion): string[] {
  const servers = Array.isArray(api?.servers) ? api.servers : [];
  const urls = servers
    .map((s: any) => (typeof s?.url === 'string' ? s.url : null))
    .filter((u: string | null): u is string => !!u);
  return urls.length > 0 ? urls : [DEFAULT_SERVERS[version]];
}

function pickBody(op: any): BodyDef | undefined {
  const rb = op?.requestBody;
  if (!rb) return undefined;
  const content = rb.content || {};
  const contentType =
    Object.keys(content).find((k) => k.toLowerCase() === 'application/json') ||
    Object.keys(content)[0];
  if (!contentType) return undefined;
  const media = content[contentType] || {};
  return {
    contentType,
    schema: media.schema,
    example: media.example ?? (media.examples ? Object.values(media.examples)[0] : undefined),
    required: !!rb.required,
  };
}

function pickResponses(op: any): Record<string, ResponseDef> {
  const out: Record<string, ResponseDef> = {};
  const responses = op?.responses || {};
  for (const [status, resp] of Object.entries<any>(responses)) {
    const content = resp?.content || {};
    const contentType = Object.keys(content)[0];
    out[status] = {
      description: resp?.description,
      contentType,
      schema: contentType ? content[contentType]?.schema : undefined,
    };
  }
  return out;
}

function normalizeParam(p: any): Param {
  return {
    name: p.name,
    in: p.in,
    required: p.required ?? (p.in === 'path'),
    schema: p.schema,
    example: p.example ?? p.schema?.example,
    description: p.description,
  };
}

function extractEndpoints(api: any, version: ApiVersion, serverUrl: string): Endpoint[] {
  const endpoints: Endpoint[] = [];
  const paths = api?.paths || {};

  for (const [rawPath, pathItem] of Object.entries<any>(paths)) {
    if (!pathItem) continue;
    const pathLevelParams: any[] = pathItem.parameters || [];

    for (const method of VALID_METHODS) {
      const op = pathItem[method.toLowerCase()];
      if (!op) continue;

      const paramMap = new Map<string, Param>();
      for (const p of pathLevelParams) paramMap.set(p.name, normalizeParam(p));
      for (const p of op.parameters || []) paramMap.set(p.name, normalizeParam(p));

      const operationId =
        op.operationId ||
        `${method.toLowerCase()}${rawPath.replace(/[^a-zA-Z0-9]/g, '_')}`;

      endpoints.push({
        method,
        path: rawPath,
        operationId,
        summary: op.summary || '',
        description: op.description || '',
        tags: op.tags || [],
        parameters: Array.from(paramMap.values()),
        requestBody: pickBody(op),
        responses: pickResponses(op),
        serverUrl,
        apiVersion: version,
      });
    }
  }
  return endpoints;
}

async function buildSpecDoc(raw: any, version: ApiVersion): Promise<SpecDoc> {
  const api: any = await SwaggerParser.dereference(raw);
  const servers = extractServers(api, version);
  const security: SecurityRequirement[] = api.security || [];
  const securitySchemes: Record<string, SecurityScheme> =
    api.components?.securitySchemes || {};
  const endpoints = extractEndpoints(api, version, servers[0]);
  return { version, servers, security, securitySchemes, endpoints };
}

export async function parseSpecs(v2Content: string, v3Content: string): Promise<SpecDoc[]> {
  const v2Raw = JSON.parse(v2Content);
  const v3Raw = yaml.load(v3Content);
  const v2Doc = await buildSpecDoc(v2Raw, 'v2');
  const v3Doc = await buildSpecDoc(v3Raw, 'v3');
  return [v2Doc, v3Doc];
}

export function allEndpoints(docs: SpecDoc[]): Endpoint[] {
  return docs.flatMap((d) => d.endpoints);
}

export function findDoc(docs: SpecDoc[], version: ApiVersion): SpecDoc | undefined {
  return docs.find((d) => d.version === version);
}
