import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { getApiToken, getTokenKind } from '../store/config';

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function buildAuthHeader(token: string): string | undefined {
  if (!token) return undefined;
  const kind = getTokenKind();
  if (kind === 'personal') return token;
  if (kind === 'bearer') return `Bearer ${token}`;
  // auto: personal tokens start with pk_
  if (token.startsWith('pk_')) return token;
  return `Bearer ${token}`;
}

export function createClient(serverUrl: string): AxiosInstance {
  const client = axios.create({
    baseURL: serverUrl,
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
  });

  client.interceptors.request.use((config) => {
    const token = getApiToken();
    const auth = buildAuthHeader(token);
    if (auth) {
      config.headers = config.headers || {};
      (config.headers as Record<string, string>)['Authorization'] = auth;
    }
    return config;
  });

  return client;
}

interface RetryOpts {
  retries?: number;
  baseDelay?: number;
}

function parseRetryAfter(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  if (!Number.isNaN(n)) return n * 1000;
  const dateMs = Date.parse(value);
  if (!Number.isNaN(dateMs)) {
    const diff = dateMs - Date.now();
    return diff > 0 ? diff : 0;
  }
  return undefined;
}

function isTransientNetworkError(err: any): boolean {
  const code = err?.code;
  return code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ECONNABORTED' || code === 'EAI_AGAIN';
}

export async function requestWithRetry(
  client: AxiosInstance,
  config: AxiosRequestConfig,
  opts: RetryOpts = {}
): Promise<AxiosResponse> {
  const retries = opts.retries ?? 3;
  const baseDelay = opts.baseDelay ?? 600;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await client.request(config);
      if (res.status === 429 && attempt < retries) {
        const headerVal = (res.headers?.['retry-after'] ?? res.headers?.['Retry-After']) as
          | string
          | undefined;
        const wait = parseRetryAfter(headerVal) ?? baseDelay * Math.pow(2, attempt);
        await sleep(wait);
        continue;
      }
      return res;
    } catch (err: any) {
      if (isTransientNetworkError(err) && attempt < retries) {
        await sleep(baseDelay * Math.pow(2, attempt));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Max retries exceeded');
}
