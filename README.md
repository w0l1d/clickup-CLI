# clickup-cli

Spec-driven command-line client for the ClickUp REST API. Downloads ClickUp's official OpenAPI documents (v2 JSON + v3 YAML), dereferences them, and exposes every declared endpoint for listing, inspection, direct invocation, and batch probing. Every path, query, header, and request body is derived from the spec — no hardcoded endpoint list.

> Package name: **`clickup-cli`** · Installed command: **`clickup`**

## Install

```bash
npm install -g clickup-cli
```

Or run without installing:

```bash
npx clickup-cli --help
```

Requires Node.js 16 or newer.

## Quick start

```bash
# 1. Get a token: https://app.clickup.com/settings/apps
clickup auth login            # guided: opens browser + prompts for token

# 2. Explore the catalog
clickup list --api v2 --search task

# 3. Inspect an endpoint before calling it
clickup describe GetTask

# 4. Call it
clickup call GetAuthorizedUser --verbose
```

On first call the CLI auto-discovers your workspace context (workspace, space, folder, list, first task) so path parameters resolve without extra flags. Specs are fetched and cached automatically on first use.

## Authentication

### Interactive setup (recommended)

```bash
clickup auth login            # opens https://app.clickup.com/settings/apps, prompts for token
clickup auth check            # validate the stored token
clickup auth whoami           # show masked token, kind, source, config path
clickup auth clear            # remove token from local config
```

### Manual / scripted

```bash
clickup auth set pk_123...            # store directly
clickup auth set eyJ... --kind bearer # OAuth token
```

### Environment variables (CI / agents / scripts)

No config file needed — set any of these and the CLI picks them up:

```bash
export CLICKUP_TOKEN='pk_xxx'          # preferred
export CLICKUP_API_TOKEN='pk_xxx'      # alternative
export CLICKUP_API_KEY='pk_xxx'        # alternative
export CLICKUP_TOKEN_KIND='personal'   # override auto-detection (personal|bearer|auto)
```

`clickup auth whoami` reports the active source (`env` vs `config`).

Token kinds:

| Kind       | Header sent                     | Use for                         |
|------------|----------------------------------|---------------------------------|
| `personal` | `Authorization: <token>`         | Personal tokens (`pk_` prefix)  |
| `bearer`   | `Authorization: Bearer <token>`  | OAuth access tokens             |
| `auto`     | Picks based on `pk_` prefix      | Default — works for both        |

Tokens are stored in `conf`'s platform-appropriate user config dir (e.g. `~/Library/Preferences/clickup-cli-nodejs/config.json` on macOS) with user-only permissions.

## Commands

### `auth`

```bash
clickup auth login            # guided onboarding — opens browser + prompts for token
clickup auth set <token>      # store token directly
clickup auth check            # validate token against /user
clickup auth whoami           # show stored token info
clickup auth clear            # remove stored token
```

### `spec`

```bash
clickup spec fetch [--force]  # download + cache v2 + v3 specs (TTL 24h; auto on first use)
clickup spec show             # cache metadata + server URLs + endpoint counts
```

Specs live under `~/.clickup-cli/cache/`. Server URLs are read from each spec's `servers[]` block, not hardcoded.

### `list`

Browse the endpoint catalog.

```bash
clickup list                          # everything
clickup list --api v3                 # only v3
clickup list --method POST            # only POSTs
clickup list --tag docs               # filter by OpenAPI tag
clickup list --search task            # match path, summary, operationId
clickup list --format json            # JSON array of endpoint objects
```

### `describe`

Show full schema for an endpoint — parameters, request body, response codes — without making any API call. Ideal for planning a `call` or letting an AI agent understand the contract.

```bash
clickup describe GetTask
clickup describe CreateTask --format json   # machine-readable full schema
clickup describe "task"                     # substring match (errors if ambiguous)
```

Output includes: required vs optional params with types and examples, request body schema, response codes.

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
clickup call GetAuthorizedUser --format json    # clean JSON envelope to stdout
```

Options:

| Flag                    | Purpose                                                                 |
|-------------------------|-------------------------------------------------------------------------|
| `--param key=value`     | Override a path/query/header param. Repeatable.                         |
| `--body <json>`         | Inline JSON request body.                                               |
| `--body-file <path>`    | JSON body from a file.                                                  |
| `--scaffold-body`       | Seed the body from the spec's example/schema, then merge `--body` atop. |
| `--custom-task-ids`     | Inject `custom_task_ids=true&team_id=<workspace>` for task endpoints.   |
| `--no-context`          | Skip workspace context resolution.                                      |
| `--format pretty\|json` | Response format (default: `pretty`). `json` → clean envelope on stdout. |
| `--verbose`             | Print resolved URL, query, headers, and body before sending.            |

### `probe`

Exercise many endpoints at once. GET is the default for safety; `--all` opts into mutating methods.

```bash
clickup probe                                   # all GETs, both versions
clickup probe --api v2 --delay 800              # 800ms between requests
clickup probe --tag docs                        # only "docs"-tagged endpoints
clickup probe --all --method POST --dry-run     # preview POSTs, no calls
clickup probe --concurrency 3                   # parallel workers (capped at 3)
clickup probe --format json                     # results as JSON
```

Probe results are persisted so you can re-render them without re-running.

### `report`

```bash
clickup report                       # last run, table view
clickup report --status error        # only failures
clickup report --format json         # machine-readable
```

### Global flags

```bash
clickup -q <command>     # --quiet: suppress all progress output, data only on stdout
```

## Exit codes

| Code | Meaning                            |
|------|------------------------------------|
| `0`  | Success                            |
| `1`  | Usage error / unexpected failure   |
| `2`  | Skipped — required params missing  |
| `3`  | API returned 4xx                   |
| `4`  | API returned 5xx                   |
| `5`  | Network error / timeout            |

## Using with Claude Code / AI agents

This CLI is designed to be scripted and agent-friendly.

### Setup for agents (no interactive prompts)

```bash
export CLICKUP_TOKEN='pk_your_token_here'
```

The token is read from the environment — no `auth login` or config file needed.

### Discover endpoints by intent

```bash
# Find endpoints related to a concept
clickup list --search task --format json | jq '.[].operationId'

# Inspect the exact contract before calling
clickup describe GetTask --format json
```

### Call endpoints and parse the result

```bash
# Clean JSON envelope — parse with jq or in code
clickup call GetAuthorizedUser --format json
# → {"ok":true,"status":"ok","httpStatus":200,"durationMs":312,"url":"...","error":null,"body":{...}}

# Exit codes are reliable for branching
clickup call GetTask --param task_id=abc --format json
echo "exit: $?"   # 0=ok, 2=missing params, 3=4xx, 4=5xx, 5=network

# Suppress all chrome — only JSON hits stdout
clickup --quiet call GetTask --param task_id=abc --format json
```

### Suppress spinners and color in scripts

```bash
export NO_COLOR=1   # disables chalk colors
export CI=1         # disables animated spinners
```

Both are auto-detected. When `--format json` is set, progress is already suppressed.

### Typical agent workflow

```bash
# 1. Check auth
clickup auth check --format json

# 2. Find the right operationId
clickup list --search "task" --format json | jq '.[].operationId'

# 3. Learn the contract
clickup describe CreateTask --format json | jq '{params: .parameters, body: .requestBody}'

# 4. Call it
clickup call CreateTask \
  --param list_id=901234567 \
  --body '{"name":"fix bug","status":"open"}' \
  --format json
```

## How spec resolution works

1. **Loader** (`src/spec/loader.ts`) downloads the v2 JSON and v3 YAML from `developer.clickup.com` and caches them on disk with a TTL (auto-fetches on first use).
2. **Parser** (`src/spec/parser.ts`) dereferences `$ref`s and builds one `SpecDoc` per version containing `servers[]`, `securitySchemes`, and fully-typed `Endpoint` records. Parameter names are preserved **verbatim** — snake_case from v2, mixed case from v3.
3. **Param resolver** (`src/runtime/params.ts`) maps your stored `WorkspaceContext` onto each endpoint's declared parameters through an alias table (`workspace_id`/`workspaceId`/`team_id`/`teamId` → `ctx.workspaceId`, etc.). Priority: `--param` overrides → context → spec example.
4. **Runner** (`src/runtime/runner.ts`) builds one `axios` client per `serverUrl`, sends the request, and retries on `429` honoring the `Retry-After` header.

## Config location

| Item                | Path                                                                 |
|---------------------|----------------------------------------------------------------------|
| Token + settings    | Platform default from [`conf`](https://github.com/sindresorhus/conf) |
| Spec cache          | `~/.clickup-cli/cache/`                                              |
| Last probe results  | Same `conf` store, under `lastProbeResults`                          |

Run `clickup auth whoami` to see the exact config path on your system.

## Developing locally

```bash
git clone <repo>
cd clickup-CLI
npm install
npm run build
node dist/index.js --help

# Watch mode:
npm run dev -- list --api v3
```

Once built and linked globally (`npm link`), the `clickup` command is on your `PATH`.

```bash
npm version patch   # or minor / major
npm publish         # prepublishOnly runs tsc automatically
```

## Security

- Tokens are read only from env vars or local config and injected in the `Authorization` header; the CLI never logs or prints full tokens.
- `validateStatus: () => true` keeps non-2xx responses as data — error bodies never surface through stack traces.
- Spec server URLs are the only base URLs used for outbound requests; no user-controlled host input.
- `npm audit` is part of the recommended pre-release check.

## License

MIT — see [LICENSE](./LICENSE).
