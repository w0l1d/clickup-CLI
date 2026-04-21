import { createClient } from './apiClient';
import { getBaseUrlV2, getWorkspaceContext, setWorkspaceContext } from './config';
import { WorkspaceContext } from '../models/workspaceContext';

export async function resolveWorkspaceContext(force = false): Promise<WorkspaceContext> {
  const existing = getWorkspaceContext();
  if (!force && existing.workspaceId && existing.resolvedAt) {
    return existing;
  }

  const client = createClient(getBaseUrlV2());
  const ctx: WorkspaceContext = {};

  try {
    const userRes = await client.get('/user');
    ctx.userId = String(userRes.data?.user?.id || '');
  } catch { /* ignore */ }

  try {
    const teamsRes = await client.get('/team');
    const team = teamsRes.data?.teams?.[0];
    if (team) {
      ctx.teamId = String(team.id);
      ctx.workspaceId = String(team.id);
    }
  } catch { /* ignore */ }

  if (ctx.teamId) {
    try {
      const spacesRes = await client.get(`/team/${ctx.teamId}/space`);
      const space = spacesRes.data?.spaces?.[0];
      if (space) ctx.spaceId = String(space.id);
    } catch { /* ignore */ }
  }

  if (ctx.spaceId) {
    try {
      const foldersRes = await client.get(`/space/${ctx.spaceId}/folder`);
      const folder = foldersRes.data?.folders?.[0];
      if (folder) ctx.folderId = String(folder.id);
    } catch { /* ignore */ }

    try {
      // Also try folderless lists
      const listsRes = await client.get(`/space/${ctx.spaceId}/list`);
      const list = listsRes.data?.lists?.[0];
      if (list) ctx.listId = String(list.id);
    } catch { /* ignore */ }
  }

  if (!ctx.listId && ctx.folderId) {
    try {
      const listsRes = await client.get(`/folder/${ctx.folderId}/list`);
      const list = listsRes.data?.lists?.[0];
      if (list) ctx.listId = String(list.id);
    } catch { /* ignore */ }
  }

  if (ctx.listId) {
    try {
      const tasksRes = await client.get(`/list/${ctx.listId}/task`);
      const task = tasksRes.data?.tasks?.[0];
      if (task) ctx.taskId = String(task.id);
    } catch { /* ignore */ }
  }

  ctx.resolvedAt = new Date().toISOString();
  setWorkspaceContext(ctx);
  return ctx;
}

// Fill path params like {team_id}, {workspace_id}, {task_id} from context
export function fillPathParams(path: string, ctx: WorkspaceContext, extra: Record<string, string> = {}): string {
  const paramMap: Record<string, string | undefined> = {
    team_id: ctx.teamId,
    workspace_id: ctx.workspaceId,
    space_id: ctx.spaceId,
    folder_id: ctx.folderId,
    list_id: ctx.listId,
    task_id: ctx.taskId,
    user_id: ctx.userId,
    ...extra,
  };

  return path.replace(/\{([^}]+)\}/g, (_, name) => {
    return paramMap[name] || extra[name] || `{${name}}`;
  });
}

export function hasUnresolvedParams(path: string): boolean {
  return /\{[^}]+\}/.test(path);
}
