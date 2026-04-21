export interface WorkspaceContext {
  userId?: string;
  workspaceId?: string;  // same as team_id in v2
  teamId?: string;
  spaceId?: string;
  folderId?: string;
  listId?: string;
  taskId?: string;
  resolvedAt?: string;
}
