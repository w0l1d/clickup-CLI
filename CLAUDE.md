# CLAUDE.md — clickup-cli

This file gives Claude Code (and any AI coding assistant) the context needed to contribute effectively without re-reading the entire codebase each session.

---

## What this project is

`@w0l1d/clickup-cli` is a **spec-driven** CLI for the ClickUp REST API. It downloads ClickUp's official OpenAPI documents (v2 JSON, v3 YAML), dereferences them, and exposes every declared endpoint. There is no hardcoded endpoint list — everything (paths, params, bodies, server URLs) comes from the spec.

Installed binary: `clickup`
npm package: `@w0l1d/clickup-cli`

---

## Key constraints — read before touching anything

- **Parameter names must match the spec verbatim.** v2 uses `snake_case`; v3 uses mixed case. Never normalize them.
- **Server URLs come from `spec.servers[]`.** Never hardcode `api.clickup.com` anywhere outside the fallback in `auth.ts`.
- **stdout is for data only.** All progress, labels, errors go to **stderr** via `src/output/ui.ts` helpers (`info`, `err`, `warn`, `note`). Never use `console.log` in command handlers.
- **`conf` project name is `clickup-cli`** (not `@w0l1d/clickup-cli`). Changing it would orphan every user's stored token and context. Do not rename it.
- **The spec cache directory is `~/.clickup-cli/cache/`.** Same rule — do not rename.
- **No test suite exists yet.** `npm run build` (tsc strict) is the current correctness gate. Do not add tests without the user's direction.

---

## Stack

| Concern | Library |
|---------|---------|
| CLI framework | `commander` v11 |
| HTTP | `axios` v1 |
| OpenAPI parsing | `@apidevtools/swagger-parser` + `js-yaml` |
| Persistent config | `conf` v10 |
| Terminal UX | `chalk` v4 · `ora` v5 |
| Language | TypeScript 5, strict mode, `commonjs` target |
| Node requirement | ≥ 18 |

---

## Source layout

```
src/
  cli.ts               Entry point — builds Commander program, wires all commands, applies --quiet hook
  index.ts             Thin re-export of cli.ts

  commands/
    auth.ts            auth login|set|check|whoami|clear
    call.ts            call <endpoint> — single endpoint invocation
    describe.ts        describe <endpoint> — schema inspection, no API call
    list.ts            list — endpoint catalog browser
    probe.ts           probe — batch endpoint exerciser
    report.ts          report — re-render last probe results
    spec.ts            spec fetch|show — spec cache management

  spec/
    model.ts           TypeScript interfaces: Endpoint, Param, BodyDef, SpecDoc, etc.
    loader.ts          Download + TTL-cache v2/v3 specs to ~/.clickup-cli/cache/
    parser.ts          Dereference $refs, build SpecDoc[] with typed Endpoint records

  runtime/
    params.ts          fillPathAndQuery — resolve params via alias table + WorkspaceContext
    body.ts            seedBody (from spec example/schema) + mergeBody
    context.ts         resolveWorkspaceContext — cascade: user → team → space → folder → list → task
    runner.ts          runEndpoint — send request, return ProbeResult; handles skip on missing params

  http/
    client.ts          createClient (per serverUrl) + requestWithRetry (429 + transient error retry)

  store/
    config.ts          conf store: token, tokenKind, workspaceContext, lastProbeResults

  output/
    ui.ts              TTY/quiet/JSON-mode detection; spinner(), info(), err(), warn(), note(), stdout()
    onboarding.ts      printTokenMissingHelp() — shown when no token is configured
    json.ts            printJson — pretty-print colored JSON to stdout
    table.ts           renderEndpointTable
    probeReport.ts     renderProbeReport + renderSummaryByTag
```

---

## Output rules

All output goes through `src/output/ui.ts`. Never bypass it with `console.log` / `console.error` in command handlers.

| Helper | Stream | Suppressed when |
|--------|--------|-----------------|
| `info(msg)` | stderr | `--quiet` or `--format json` |
| `note(msg)` | stderr | `--quiet` or `--format json` |
| `warn(msg)` | stderr | never |
| `err(msg)` | stderr | never |
| `stdout(msg)` | stdout | never |
| `spinner(text)` | stderr | `--quiet`, `--format json`, non-TTY, `CI=1` |

Set mode early in each action handler:
```ts
if (opts.format === 'json') setJsonMode(true);
```

`--quiet` is a global flag handled in `cli.ts` via a `preAction` hook — no per-command wiring needed.

---

## Token resolution order

1. `CLICKUP_TOKEN` env var
2. `CLICKUP_API_TOKEN` env var
3. `CLICKUP_API_KEY` env var
4. `conf` store (`apiToken` key)

`getTokenSource()` returns `'env'`, `'config'`, or `'none'`. Auth header auto-detection: `pk_` prefix → raw token; otherwise `Bearer <token>`.

---

## Exit codes (call command)

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Usage / unexpected error |
| 2 | Skipped — required params unresolved |
| 3 | API 4xx |
| 4 | API 5xx |
| 5 | Network error / timeout |

---

## Param alias table (`src/runtime/params.ts`)

The table maps `WorkspaceContext` fields to all the spec param name variants they satisfy:

| Context field | Resolved for spec params named… |
|---------------|---------------------------------|
| `workspaceId` | `workspace_id`, `workspaceId`, `team_id`, `teamId` |
| `spaceId` | `space_id`, `spaceId` |
| `folderId` | `folder_id`, `folderId` |
| `listId` | `list_id`, `listId` |
| `taskId` | `task_id`, `taskId` |
| `docId` | `doc_id`, `docId` |
| `pageId` | `page_id`, `pageId` |
| `viewId` | `view_id`, `viewId` |
| `channelId` | `channel_id`, `channelId` |

Resolution priority: `--param` overrides → context → spec `example` → spec `default`.

---

## Workspace context auto-discovery (`src/runtime/context.ts`)

Cascade on first call (cached in `conf`):
1. `GET /v2/user` → `userId`
2. `GET /v2/team` → first workspace → `workspaceId`
3. `GET /v2/team/{workspaceId}/space` → first space → `spaceId`
4. `GET /v2/space/{spaceId}/folder` → first folder → `folderId`; fallback: folderless lists
5. `GET /v2/folder/{folderId}/list` → first list → `listId`
6. `GET /v2/list/{listId}/task` → first task → `taskId`
7. Best-effort v3 enrichment (docs, channels) using `inferPrefix` to derive the correct path prefix

`inferPrefix(docs, version, fallback)` — extracts `/v2` or `/api/v3` from the first endpoint path in the given doc.

---

## CI / release

- **CI** (`.github/workflows/ci.yml`): runs `npm ci && npm run build` on Node 18 + 20 for every push to `master`/`main` and all PRs.
- **Release** (`.github/workflows/release.yml`): triggered by `v*` tags or manual `workflow_dispatch`; publishes to npm using `NPM_TOKEN` secret. Access defaults to `restricted`.

Release flow:
```bash
npm version minor        # bumps package.json, no auto git tag (use --no-git-tag-version if needed)
# update CHANGELOG.md
git add . && git commit -m "chore: release vX.Y.Z"
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin master && git push origin vX.Y.Z
```

The tag push triggers the GitHub Actions release workflow.

---

## Common tasks

### Add a new command

1. Create `src/commands/<name>.ts` exporting `registerXxx(program: Command): void`.
2. Import and call it in `src/cli.ts`.
3. Use `spinner()`, `info()`, `err()`, `stdout()` from `src/output/ui.ts` — never `console.*`.
4. Call `setJsonMode(true)` at the top of the action handler when `opts.format === 'json'`.
5. All data to stdout via `stdout()`; all chrome to stderr via `info()` / `err()`.

### Add a new param alias

Edit the `ALIAS_TABLE` in `src/runtime/params.ts`. Key = `WorkspaceContext` field name; value = array of spec param names it satisfies.

### Change the spec TTL

`getSpecCacheTtlHours()` reads from `conf` (default 24). Users can override via `conf` directly; no CLI flag yet.

### Regenerate dist after edits

```bash
npm run build     # tsc, outputs to dist/
```

No watch mode that auto-reloads; use `npm run dev -- <args>` (ts-node) during development.
