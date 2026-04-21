# clickup-cli

Spec-driven command-line client for the ClickUp REST API. It downloads ClickUp's official OpenAPI documents (v2 JSON + v3 YAML), dereferences them, and exposes every declared endpoint for listing, inspection, direct invocation, and batch probing. Every path, query, header, and request body is derived from the spec — no hardcoded endpoint list.

> Package name: **`clickup-cli`** · Installed command: **`clickup`**

## Install

Global install (recommended for CLI use):

```bash
npm install -g clickup-cli
```

The installed binary is named `clickup`.

Or run without installing:

```bash
npx clickup-cli --help
```

Requires Node.js 16 or newer.

## Quick start

```bash
# 1. Cache the OpenAPI specs locally
clickup spec fetch

# 2. Store your ClickUp API token
clickup auth set pk_xxxxxxxxxxxxxxxxx

# 3. Confirm the token is valid
clickup auth check

# 4. Explore the catalog
clickup list --api v3 --search docs

# 5. Call an endpoint directly
clickup call GetAuthorizedUser --verbose
```

On first call, the CLI auto-discovers your workspace context (workspace, space, folder, list, first task) so path parameters resolve without extra flags.

## Authentication

`clickup` supports two token flavors:

| Kind       | Header sent                     | Use for                                          |
|------------|----------------------------------|--------------------------------------------------|
| `personal` | `Authorization: <token>`         | Personal API tokens (prefixed `pk_`)             |
| `bearer`   | `Authorization: Bearer <token>`  | OAuth access tokens                              |
| `auto`     | Picks based on `pk_` prefix      | Default — works for both                         |

```bash
clickup auth set pk_123... --kind personal
clickup auth set eyJhbGciOi... --kind bearer
clickup auth whoami        # shows masked token + kind
clickup auth clear         # wipes stored token
```

Tokens are stored in `conf`'s platform-appropriate user config dir (e.g. `~/Library/Preferences/clickup-cli-nodejs/config.json` on macOS) with user-only permissions.

## Commands

### `spec`

```bash
clickup spec fetch [--force]   # download + cache v2 + v3 specs (default TTL 24h)
clickup spec show              # cache metadata + server URLs + endpoint counts
```

Specs live under `~/.clickup-cli/cache/`. Server URLs are read from each spec's `servers[]` block, not hardcoded.

### `list`

Browse the catalog.

```bash
clickup list                                  # everything
clickup list --api v3                         # only v3
clickup list --method POST                    # only POSTs
clickup list --tag docs                       # filter by OpenAPI tag
clickup list --search task                    # match path, summary, operationId
clickup list --format json                    # JSON instead of table
```

### `call`

Invoke a single endpoint. Identify it by `operationId`, by `METHOD /path`, or by a substring match.

```bash
clickup call GetAuthorizedUser
clickup call "GET /v2/task/{task_id}" --param task_id=869abc123
clickup call CreateTask \
  --param list_id=901234567 \
  --body '{"name":"Write docs","status":"open"}'
clickup call CreateTask --scaffold-body --body '{"name":"override"}'
clickup call GetTask --param task_id=MYCUSTOM-1 --custom-task-ids
clickup call GetAuthorizedUser --no-context     # skip workspace auto-discovery
clickup call GetAuthorizedUser --verbose        # show resolved URL, headers, body
```

Options:

| Flag                  | Purpose                                                                 |
|-----------------------|-------------------------------------------------------------------------|
| `--param key=value`   | Override a path/query/header param. Repeatable.                         |
| `--body <json>`       | Inline JSON request body.                                               |
| `--body-file <path>`  | JSON body from a file.                                                  |
| `--scaffold-body`     | Seed the body from the spec's example/schema, then merge `--body` atop. |
| `--custom-task-ids`   | Inject `custom_task_ids=true&team_id=<workspace>` for task endpoints.   |
| `--no-context`        | Skip workspace context resolution.                                      |
| `--format pretty\|json` | Response format (default: `pretty`, with color).                      |
| `--verbose`           | Print resolved URL, query, headers, and body before sending.            |

Unresolved required parameters cause the call to be skipped with a clear message listing which params are missing.

### `probe`

Exercise many endpoints at once. GET is the default for safety; `--all` opts into mutating methods.

```bash
clickup probe                                   # all GETs, both versions
clickup probe --api v2 --delay 800              # 800ms between requests
clickup probe --tag docs                        # only "docs"-tagged endpoints
clickup probe --all --method POST --dry-run     # preview POSTs, no calls
clickup probe --concurrency 3                   # parallel workers (capped at 3)
```

Probe results are persisted so you can re-render them without re-running.

### `report`

```bash
clickup report                       # last run, table view
clickup report --status error        # only failures
clickup report --format json         # machine-readable
```

## How spec resolution works

1. **Loader** (`src/spec/loader.ts`) downloads the v2 JSON and v3 YAML from `developer.clickup.com` and caches them on disk with a TTL.
2. **Parser** (`src/spec/parser.ts`) runs `swagger-parser` to dereference `$ref`s, then builds one `SpecDoc` per version containing `servers[]`, `securitySchemes`, and fully-typed `Endpoint` records. Parameter names are preserved **verbatim** — snake_case from v2, mixed case from v3.
3. **Param resolver** (`src/runtime/params.ts`) maps your stored `WorkspaceContext` onto each endpoint's declared parameters through an alias table (`workspace_id`, `workspaceId`, `team_id`, `teamId` → `ctx.workspaceId`, etc.). Overrides from `--param` take precedence, then context, then the parameter's spec `example`.
4. **Runner** (`src/runtime/runner.ts`) builds one `axios` client per endpoint's `serverUrl` (v2 and v3 live on different hosts), sends the request, and retries on `429` honoring the `Retry-After` header.

## Config location

| Item                | Path                                                              |
|---------------------|-------------------------------------------------------------------|
| Token + settings    | Platform default from [`conf`](https://github.com/sindresorhus/conf) |
| Spec cache          | `~/.clickup-cli/cache/`                                           |
| Last probe results  | In the same `conf` store, under `lastProbeResults`                |

Run `clickup auth whoami` to see the exact config path on your system.

## Developing locally

```bash
git clone <repo>
cd clickup-CLI
npm install
npm run build
node dist/index.js --help

# Watch mode alternative:
npm run dev -- list --api v3
```

Once built and linked globally (`npm link`), the command `clickup` is available on your `PATH`.

Publish workflow:

```bash
npm version patch       # or minor / major
npm publish             # prepublishOnly runs tsc automatically
```

## Security

- Tokens are read only from local config and injected in the request `Authorization` header; the CLI never logs full tokens.
- `validateStatus: () => true` keeps non-2xx responses as data, so error bodies don't escape through stack traces.
- Spec server URLs are the only base URLs used for outbound requests; there is no user-controlled host input.
- `npm audit` is part of the recommended pre-release check.

## License

MIT — see [LICENSE](./LICENSE).
