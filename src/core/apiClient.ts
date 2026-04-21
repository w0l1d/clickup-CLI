import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { getApiKey } from './config';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function createClient(baseURL: string): AxiosInstance {
  const client = axios.create({
    baseURL,
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
  });

  client.interceptors.request.use(config => {
    const key = getApiKey();
    if (key) config.headers['Authorization'] = key;
    return config;
  });

  return client;
}

export async function requestWithRetry(
  client: AxiosInstance,
  config: Parameters<AxiosInstance['request']>[0],
  retries = 3,
  delayMs = 600
): Promise<AxiosResponse> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await client.request(config);
    } catch (err: any) {
      if (err.response?.status === 429 && attempt < retries) {
        const wait = delayMs * Math.pow(2, attempt);
        await sleep(wait);
        continue;
      }
      throw err;
    }
  }
  throw new Error('Max retries exceeded');
}
