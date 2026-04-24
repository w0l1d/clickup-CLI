// eslint-disable-next-line @typescript-eslint/no-var-requires
const Conf = require('conf');

export type TokenKind = 'personal' | 'bearer' | 'auto';

export interface WorkspaceContext {
  userId?: string;
  workspaceId?: string;
  spaceId?: string;
  folderId?: string;
  listId?: string;
  taskId?: string;
  viewId?: string;
  docId?: string;
  pageId?: string;
  channelId?: string;
  resolvedAt?: string;
}

export interface StoredEndpoint {
  method: string;
  path: string;
  operationId: string;
  apiVersion: 'v2' | 'v3';
  tags: string[];
  summary: string;
}

export interface ProbeResult {
  endpoint: StoredEndpoint;
  status: 'ok' | 'error' | 'skip' | 'rate_limited' | 'timeout';
  httpStatus?: number;
  durationMs?: number;
  responseSnippet?: string;
  errorMessage?: string;
  resolvedUrl?: string;
}

interface ConfigSchema {
  apiToken: string;
  tokenKind: TokenKind;
  specCacheTtlHours: number;
  workspaceContext: WorkspaceContext;
  lastProbeResults: ProbeResult[];
  lastProbedAt: string;
}

const conf = new Conf({
  projectName: 'clickup-cli',
  defaults: {
    apiToken: '',
    tokenKind: 'auto' as TokenKind,
    specCacheTtlHours: 24,
    workspaceContext: {},
    lastProbeResults: [],
    lastProbedAt: '',
  },
}) as InstanceType<typeof Conf> & {
  get<K extends keyof ConfigSchema>(key: K): ConfigSchema[K];
  set<K extends keyof ConfigSchema>(key: K, value: ConfigSchema[K]): void;
  delete<K extends keyof ConfigSchema>(key: K): void;
  path: string;
};

export function getApiToken(): string {
  const env =
    process.env.CLICKUP_TOKEN ||
    process.env.CLICKUP_API_TOKEN ||
    process.env.CLICKUP_API_KEY;
  if (env && env.trim()) return env.trim();
  return conf.get('apiToken');
}
export function getTokenSource(): 'env' | 'config' | 'none' {
  const env =
    process.env.CLICKUP_TOKEN ||
    process.env.CLICKUP_API_TOKEN ||
    process.env.CLICKUP_API_KEY;
  if (env && env.trim()) return 'env';
  if (conf.get('apiToken')) return 'config';
  return 'none';
}
export function setApiToken(token: string): void { conf.set('apiToken', token); }
export function clearApiToken(): void { conf.set('apiToken', ''); }

export function getTokenKind(): TokenKind {
  const env = process.env.CLICKUP_TOKEN_KIND;
  if (env === 'personal' || env === 'bearer' || env === 'auto') return env;
  return conf.get('tokenKind');
}
export function setTokenKind(kind: TokenKind): void { conf.set('tokenKind', kind); }

export function getSpecCacheTtlHours(): number { return conf.get('specCacheTtlHours'); }

export function getWorkspaceContext(): WorkspaceContext { return conf.get('workspaceContext'); }
export function setWorkspaceContext(ctx: WorkspaceContext): void { conf.set('workspaceContext', ctx); }
export function clearWorkspaceContext(): void { conf.set('workspaceContext', {}); }

export function getLastProbeResults(): ProbeResult[] { return conf.get('lastProbeResults'); }
export function getLastProbedAt(): string { return conf.get('lastProbedAt'); }
export function setLastProbeResults(results: ProbeResult[], probedAt: string): void {
  conf.set('lastProbeResults', results);
  conf.set('lastProbedAt', probedAt);
}

export function getConfigPath(): string { return conf.path; }
