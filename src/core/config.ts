// eslint-disable-next-line @typescript-eslint/no-var-requires
const Conf = require('conf');
import { WorkspaceContext } from '../models/workspaceContext';
import { ProbeResult } from '../models/probeResult';

interface ConfigSchema {
  apiKey: string;
  baseUrlV2: string;
  baseUrlV3: string;
  specCacheTtlHours: number;
  workspaceContext: WorkspaceContext;
  lastProbeResults: ProbeResult[];
  lastProbedAt: string;
}

const conf = new Conf({
  projectName: 'clickup-cli',
  defaults: {
    apiKey: '',
    baseUrlV2: 'https://api.clickup.com/api/v2',
    baseUrlV3: 'https://api.clickup.com/api/v3',
    specCacheTtlHours: 24,
    workspaceContext: {},
    lastProbeResults: [],
    lastProbedAt: '',
  },
}) as InstanceType<typeof Conf> & { get<K extends keyof ConfigSchema>(key: K): ConfigSchema[K]; set<K extends keyof ConfigSchema>(key: K, value: ConfigSchema[K]): void; path: string };

export function getApiKey(): string { return conf.get('apiKey'); }
export function setApiKey(key: string): void { conf.set('apiKey', key); }
export function getBaseUrlV2(): string { return conf.get('baseUrlV2'); }
export function getBaseUrlV3(): string { return conf.get('baseUrlV3'); }
export function getSpecCacheTtlHours(): number { return conf.get('specCacheTtlHours'); }
export function getWorkspaceContext(): WorkspaceContext { return conf.get('workspaceContext'); }
export function setWorkspaceContext(ctx: WorkspaceContext): void { conf.set('workspaceContext', ctx); }
export function getLastProbeResults(): ProbeResult[] { return conf.get('lastProbeResults'); }
export function setLastProbeResults(results: ProbeResult[], probedAt: string): void {
  conf.set('lastProbeResults', results);
  conf.set('lastProbedAt', probedAt);
}
export function getLastProbedAt(): string { return conf.get('lastProbedAt'); }
export function getConfigPath(): string { return conf.path; }
