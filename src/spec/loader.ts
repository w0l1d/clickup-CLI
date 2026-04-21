import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import axios from 'axios';
import { getSpecCacheTtlHours } from '../store/config';

const CACHE_DIR = path.join(os.homedir(), '.clickup-cli', 'cache');
const V2_URL = 'https://developer.clickup.com/openapi/clickup-api-v2-reference.json';
const V3_URL = 'https://developer.clickup.com/openapi/ClickUp_PUBLIC_API_V3.yaml';
const V2_CACHE = path.join(CACHE_DIR, 'spec-v2.json');
const V3_CACHE = path.join(CACHE_DIR, 'spec-v3.yaml');
const META_CACHE = path.join(CACHE_DIR, 'spec-meta.json');

export interface SpecMeta {
  v2FetchedAt: string;
  v3FetchedAt: string;
}

function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function isStale(fetchedAt: string | undefined, ttlHours: number): boolean {
  if (!fetchedAt) return true;
  const age = Date.now() - new Date(fetchedAt).getTime();
  return age > ttlHours * 3600 * 1000;
}

function readMeta(): SpecMeta {
  try {
    return JSON.parse(fs.readFileSync(META_CACHE, 'utf8'));
  } catch {
    return { v2FetchedAt: '', v3FetchedAt: '' };
  }
}

function writeMeta(meta: SpecMeta): void {
  fs.writeFileSync(META_CACHE, JSON.stringify(meta, null, 2));
}

export async function fetchSpecs(force = false): Promise<{ v2: string; v3: string }> {
  ensureCacheDir();
  const meta = readMeta();
  const ttl = getSpecCacheTtlHours();
  const now = new Date().toISOString();

  let v2Content: string;
  if (!force && !isStale(meta.v2FetchedAt, ttl) && fs.existsSync(V2_CACHE)) {
    v2Content = fs.readFileSync(V2_CACHE, 'utf8');
  } else {
    const res = await axios.get(V2_URL, { responseType: 'text', timeout: 15000, transformResponse: [(d) => d] });
    v2Content = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    fs.writeFileSync(V2_CACHE, v2Content);
    meta.v2FetchedAt = now;
  }

  let v3Content: string;
  if (!force && !isStale(meta.v3FetchedAt, ttl) && fs.existsSync(V3_CACHE)) {
    v3Content = fs.readFileSync(V3_CACHE, 'utf8');
  } else {
    const res = await axios.get(V3_URL, { responseType: 'text', timeout: 15000, transformResponse: [(d) => d] });
    v3Content = typeof res.data === 'string' ? res.data : String(res.data);
    fs.writeFileSync(V3_CACHE, v3Content);
    meta.v3FetchedAt = now;
  }

  writeMeta(meta);
  return { v2: v2Content, v3: v3Content };
}

export function getCacheInfo(): { v2Path: string; v3Path: string; meta: SpecMeta; cacheDir: string } {
  return { v2Path: V2_CACHE, v3Path: V3_CACHE, meta: readMeta(), cacheDir: CACHE_DIR };
}
