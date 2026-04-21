import { Endpoint, Param } from '../spec/model';
import { WorkspaceContext } from '../store/config';

type CtxKey =
  | 'workspaceId'
  | 'spaceId'
  | 'folderId'
  | 'listId'
  | 'taskId'
  | 'userId'
  | 'viewId'
  | 'docId'
  | 'pageId'
  | 'channelId';

const ALIAS_TABLE: Record<CtxKey, string[]> = {
  workspaceId: ['workspace_id', 'workspaceId', 'team_id', 'teamId'],
  spaceId: ['space_id', 'spaceId'],
  folderId: ['folder_id', 'folderId'],
  listId: ['list_id', 'listId'],
  taskId: ['task_id', 'taskId'],
  userId: ['user_id', 'userId', 'member_id', 'memberId'],
  viewId: ['view_id', 'viewId'],
  docId: ['doc_id', 'docId'],
  pageId: ['page_id', 'pageId'],
  channelId: ['channel_id', 'channelId', 'chat_channel_id'],
};

function contextValueForName(name: string, ctx: WorkspaceContext): string | undefined {
  for (const [key, aliases] of Object.entries(ALIAS_TABLE) as [CtxKey, string[]][]) {
    if (aliases.includes(name)) {
      const v = ctx[key];
      if (v != null && v !== '') return String(v);
    }
  }
  return undefined;
}

export interface ResolvedParam {
  value?: string;
  source: 'override' | 'context' | 'example' | 'missing';
}

export function resolveParamValue(
  param: Param,
  ctx: WorkspaceContext,
  overrides: Record<string, string>
): ResolvedParam {
  if (Object.prototype.hasOwnProperty.call(overrides, param.name)) {
    return { value: overrides[param.name], source: 'override' };
  }
  const ctxVal = contextValueForName(param.name, ctx);
  if (ctxVal !== undefined) return { value: ctxVal, source: 'context' };

  const ex = param.example ?? param.schema?.example ?? param.schema?.default;
  if (ex !== undefined && ex !== null) {
    return { value: String(ex), source: 'example' };
  }
  return { source: 'missing' };
}

export interface FilledRequest {
  url: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  missing: string[];
}

export function fillPathAndQuery(
  endpoint: Endpoint,
  ctx: WorkspaceContext,
  overrides: Record<string, string>
): FilledRequest {
  const query: Record<string, string> = {};
  const headers: Record<string, string> = {};
  const missing: string[] = [];

  let url = endpoint.path;

  for (const p of endpoint.parameters) {
    const resolved = resolveParamValue(p, ctx, overrides);
    if (resolved.source === 'missing' || resolved.value === undefined) {
      if (p.required) missing.push(`${p.in}:${p.name}`);
      continue;
    }
    const v = resolved.value;
    if (p.in === 'path') {
      url = url.replace(new RegExp(`\\{${p.name}\\}`, 'g'), encodeURIComponent(v));
    } else if (p.in === 'query') {
      query[p.name] = v;
    } else if (p.in === 'header') {
      headers[p.name] = v;
    }
  }

  // Custom task IDs: ClickUp convention — when calling task endpoints with a custom ID,
  // pass custom_task_ids=true plus team_id=<workspace>. Only enable if the endpoint's
  // spec actually exposes custom_task_ids as a query parameter.
  if (
    overrides['custom_task_ids'] === 'true' &&
    endpoint.parameters.some((p) => p.name === 'custom_task_ids' && p.in === 'query')
  ) {
    query['custom_task_ids'] = 'true';
    const teamId =
      overrides['team_id'] ??
      overrides['teamId'] ??
      ctx.workspaceId;
    if (teamId) query['team_id'] = String(teamId);
  }

  // Unresolved path placeholders → missing
  const leftover = url.match(/\{([^}]+)\}/g);
  if (leftover) {
    for (const m of leftover) {
      const name = m.slice(1, -1);
      if (!missing.includes(`path:${name}`)) missing.push(`path:${name}`);
    }
  }

  return { url, query, headers, missing };
}
