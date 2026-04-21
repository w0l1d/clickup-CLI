import { createClient, requestWithRetry } from './apiClient';
import { EndpointDef } from '../models/endpoint';
import { ProbeResult } from '../models/probeResult';
import { getBaseUrlV2, getBaseUrlV3 } from './config';
import { fillPathParams, hasUnresolvedParams } from './paramResolver';
import { WorkspaceContext } from '../models/workspaceContext';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function runEndpoint(
  endpoint: EndpointDef,
  ctx: WorkspaceContext,
  extraParams: Record<string, string> = {},
  body?: unknown,
  delayMs = 0
): Promise<ProbeResult> {
  if (delayMs > 0) await sleep(delayMs);

  const baseUrl = endpoint.apiVersion === 'v2' ? getBaseUrlV2() : getBaseUrlV3();
  const client = createClient(baseUrl);

  // Build URL
  const filledPath = fillPathParams(endpoint.path, ctx, extraParams);
  if (hasUnresolvedParams(filledPath)) {
    return {
      endpoint,
      status: 'skip',
      errorMessage: `Unresolvable params: ${filledPath}`,
    };
  }

  // Build query params (only query-type params with defaults)
  const queryParams: Record<string, string> = {};
  for (const param of endpoint.parameters) {
    if (param.in === 'query' && extraParams[param.name]) {
      queryParams[param.name] = extraParams[param.name];
    }
  }

  const start = Date.now();
  try {
    const res = await requestWithRetry(client, {
      method: endpoint.method,
      url: filledPath,
      params: queryParams,
      data: body,
      validateStatus: () => true, // Don't throw on non-2xx
    });
    const durationMs = Date.now() - start;
    const bodyStr = JSON.stringify(res.data).slice(0, 200);

    return {
      endpoint,
      status: res.status >= 200 && res.status < 300 ? 'ok' : (res.status === 429 ? 'rate_limited' : 'error'),
      httpStatus: res.status,
      durationMs,
      responseSnippet: bodyStr,
      resolvedUrl: filledPath,
    };
  } catch (err: any) {
    const durationMs = Date.now() - start;
    if (err.code === 'ECONNABORTED') {
      return { endpoint, status: 'timeout', durationMs, errorMessage: 'Request timed out' };
    }
    return {
      endpoint,
      status: 'error',
      durationMs,
      errorMessage: err.message,
      resolvedUrl: filledPath,
    };
  }
}
