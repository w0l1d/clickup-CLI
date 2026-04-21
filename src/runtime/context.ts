import { createClient, requestWithRetry } from '../http/client';
import { SpecDoc } from '../spec/model';
import { findDoc } from '../spec/parser';
import {
  getWorkspaceContext,
  setWorkspaceContext,
  WorkspaceContext,
} from '../store/config';

function pickServer(docs: SpecDoc[], version: 'v2' | 'v3'): string {
  const doc = findDoc(docs, version);
  return doc?.servers[0] || (version === 'v2'
    ? 'https://api.clickup.com/api/v2'
    : 'https://api.clickup.com/api/v3');
}

// Many ClickUp spec paths already carry the version prefix (e.g. "/v2/user",
// "/api/v3/workspaces/..."). When we issue "convention" calls not driven by
// a specific endpoint, we need that same prefix.
function inferPrefix(docs: SpecDoc[], version: 'v2' | 'v3', fallback: string): string {
  const doc = findDoc(docs, version);
  const sample = doc?.endpoints[0]?.path;
  if (!sample) return fallback;
  const m = sample.match(/^(\/[^/]+(?:\/v\d+)?)\//);
  return m ? m[1] : fallback;
}

async function safeGet<T = any>(serverUrl: string, path: string, params?: Record<string, string>): Promise<T | undefined> {
  try {
    const client = createClient(serverUrl);
    const res = await requestWithRetry(client, {
      method: 'GET',
      url: path,
      params,
      validateStatus: () => true,
    }, { retries: 1 });
    if (res.status >= 200 && res.status < 300) return res.data as T;
    return undefined;
  } catch {
    return undefined;
  }
}

export interface ResolveOpts {
  force?: boolean;
}

export async function resolveWorkspaceContext(
  docs: SpecDoc[],
  opts: ResolveOpts = {}
): Promise<WorkspaceContext> {
  const existing = getWorkspaceContext();
  if (!opts.force && existing.workspaceId && existing.resolvedAt) {
    return existing;
  }

  const v2Server = pickServer(docs, 'v2');
  const v3Server = pickServer(docs, 'v3');
  const v2Prefix = inferPrefix(docs, 'v2', '/v2');
  const v3Prefix = inferPrefix(docs, 'v3', '/api/v3');
  const ctx: WorkspaceContext = {};

  const userRes: any = await safeGet(v2Server, `${v2Prefix}/user`);
  if (userRes?.user?.id != null) ctx.userId = String(userRes.user.id);

  const teamRes: any = await safeGet(v2Server, `${v2Prefix}/team`);
  const team = teamRes?.teams?.[0];
  if (team?.id != null) ctx.workspaceId = String(team.id);

  if (ctx.workspaceId) {
    const spacesRes: any = await safeGet(v2Server, `${v2Prefix}/team/${ctx.workspaceId}/space`);
    const space = spacesRes?.spaces?.[0];
    if (space?.id != null) ctx.spaceId = String(space.id);
  }

  if (ctx.spaceId) {
    const foldersRes: any = await safeGet(v2Server, `${v2Prefix}/space/${ctx.spaceId}/folder`);
    const folder = foldersRes?.folders?.[0];
    if (folder?.id != null) ctx.folderId = String(folder.id);

    const listsRes: any = await safeGet(v2Server, `${v2Prefix}/space/${ctx.spaceId}/list`);
    const list = listsRes?.lists?.[0];
    if (list?.id != null) ctx.listId = String(list.id);
  }

  if (!ctx.listId && ctx.folderId) {
    const listsRes: any = await safeGet(v2Server, `${v2Prefix}/folder/${ctx.folderId}/list`);
    const list = listsRes?.lists?.[0];
    if (list?.id != null) ctx.listId = String(list.id);
  }

  if (ctx.listId) {
    const tasksRes: any = await safeGet(v2Server, `${v2Prefix}/list/${ctx.listId}/task`);
    const task = tasksRes?.tasks?.[0];
    if (task?.id != null) ctx.taskId = String(task.id);
  }

  // v3 best-effort enrichment
  if (ctx.workspaceId) {
    const docsRes: any = await safeGet(v3Server, `${v3Prefix}/workspaces/${ctx.workspaceId}/docs`, { limit: '1' });
    const doc = docsRes?.docs?.[0] ?? docsRes?.data?.[0];
    if (doc?.id != null) ctx.docId = String(doc.id);

    const channelsRes: any = await safeGet(v3Server, `${v3Prefix}/workspaces/${ctx.workspaceId}/chat/channels`, { limit: '1' });
    const channel = channelsRes?.data?.[0] ?? channelsRes?.channels?.[0];
    if (channel?.id != null) ctx.channelId = String(channel.id);
  }

  ctx.resolvedAt = new Date().toISOString();
  setWorkspaceContext(ctx);
  return ctx;
}
