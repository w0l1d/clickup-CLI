import { createClient, requestWithRetry } from '../http/client';
import { Endpoint } from '../spec/model';
import { ProbeResult, StoredEndpoint, WorkspaceContext } from '../store/config';
import { fillPathAndQuery } from './params';

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function toStoredEndpoint(endpoint: Endpoint): StoredEndpoint {
  return {
    method: endpoint.method,
    path: endpoint.path,
    operationId: endpoint.operationId,
    apiVersion: endpoint.apiVersion,
    tags: endpoint.tags,
    summary: endpoint.summary,
  };
}

export interface RunOptions {
  overrides?: Record<string, string>;
  body?: unknown;
  delayMs?: number;
}

export async function runEndpoint(
  endpoint: Endpoint,
  ctx: WorkspaceContext,
  opts: RunOptions = {}
): Promise<ProbeResult> {
  const delayMs = opts.delayMs ?? 0;
  if (delayMs > 0) await sleep(delayMs);

  const overrides = opts.overrides ?? {};
  const stored = toStoredEndpoint(endpoint);
  const filled = fillPathAndQuery(endpoint, ctx, overrides);

  if (filled.missing.length > 0) {
    return {
      endpoint: stored,
      status: 'skip',
      errorMessage: `Unresolved required params: ${filled.missing.join(', ')}`,
      resolvedUrl: filled.url,
    };
  }

  const client = createClient(endpoint.serverUrl);
  const start = Date.now();

  try {
    const res = await requestWithRetry(client, {
      method: endpoint.method,
      url: filled.url,
      params: filled.query,
      headers: filled.headers,
      data: opts.body,
      validateStatus: () => true,
    });
    const durationMs = Date.now() - start;
    const snippet = (() => {
      try { return JSON.stringify(res.data).slice(0, 400); }
      catch { return String(res.data).slice(0, 400); }
    })();

    const status: ProbeResult['status'] =
      res.status >= 200 && res.status < 300
        ? 'ok'
        : res.status === 429
        ? 'rate_limited'
        : 'error';

    return {
      endpoint: stored,
      status,
      httpStatus: res.status,
      durationMs,
      responseSnippet: snippet,
      resolvedUrl: filled.url,
    };
  } catch (err: any) {
    const durationMs = Date.now() - start;
    if (err?.code === 'ECONNABORTED' || err?.code === 'ETIMEDOUT') {
      return {
        endpoint: stored,
        status: 'timeout',
        durationMs,
        errorMessage: 'Request timed out',
        resolvedUrl: filled.url,
      };
    }
    return {
      endpoint: stored,
      status: 'error',
      durationMs,
      errorMessage: err?.message || String(err),
      resolvedUrl: filled.url,
    };
  }
}
