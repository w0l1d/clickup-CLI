import { EndpointDef } from './endpoint';

export type ProbeStatus = 'ok' | 'error' | 'skip' | 'rate_limited' | 'timeout';

export interface ProbeResult {
  endpoint: EndpointDef;
  status: ProbeStatus;
  httpStatus?: number;
  durationMs?: number;
  errorMessage?: string;
  responseSnippet?: string;
  resolvedUrl?: string;
}
