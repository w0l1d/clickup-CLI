# clickup-cli

[![npm](https://img.shields.io/npm/v/@w0l1d/clickup-cli)](https://www.npmjs.com/package/@w0l1d/clickup-cli)
[![CI](https://github.com/w0l1d/clickup-CLI/actions/workflows/ci.yml/badge.svg)](https://github.com/w0l1d/clickup-CLI/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Spec-driven command-line client for the ClickUp REST API. Downloads ClickUp's official OpenAPI documents (v2 JSON + v3 YAML), dereferences them, and exposes every declared endpoint for listing, inspection, direct invocation, and batch probing — no hardcoded endpoint list.

> **Package:** `@w0l1d/clickup-cli` · **Command:** `clickup`

---

## Install

```bash
npm install -g @w0l1d/clickup-cli
```

Or run without installing:

```bash
npx @w0l1d/clickup-cli --help
```

Requires **Node.js 18+**.

---

## Quick start

```bash
# 1. Guided token setup (opens browser → prompts for token → validates)
clickup auth login

# 2. Explore what's available
clickup list --search task --api v2

# 3. Inspect an endpoint before calling it
clickup describe GetTask

# 4. Call it
clickup call GetTask --param task_id=9hz
```

Specs are fetched and cached automatically on first use. Workspace context (workspace → space → folder → list → task) is auto-discovered so most path params resolve without `--param`.

---

## Authentication

### Guided setup

```bash
clickup auth login      # opens https://app.clickup.com/settings/apps, prompts for token
clickup auth check      # validate stored token
clickup auth whoami     # show masked token, kind, source, config path
clickup auth clear      # remove token from local config
clickup auth set <tok>  # store a token directly
```

### Environment variables — for CI, scripts, and AI agents

No config file needed. Set any one of:

```bash
export CLICKUP_TOKEN='pk_xxxxxxxxxxxxxxxxxxxx'   # preferred
export CLICKUP_API_TOKEN='pk_xxx'                # alternative
export CLICKUP_API_KEY='pk_xxx'                  # alternative
export CLICKUP_TOKEN_KIND='personal'             # optional: personal | bearer | auto
```

`clickup auth whoami` shows `Source: env` when a variable is active.

### Token kinds

| Kind       | `Authorization` header sent      | Use for                        |
|------------|----------------------------------|--------------------------------|
| `personal` | `<token>`                        | Personal tokens (`pk_` prefix) |
| `bearer`   | `Bearer <token>`                 | OAuth access tokens            |
| `auto`     | Picks based on `pk_` prefix      | Default — works for both       |

---

## Commands

### `auth`

| Subcommand        | Description                                             |
|-------------------|---------------------------------------------------------|
| `login`           | Guided setup: opens browser, prompts for token, checks it |
| `set <token>`     | Store token directly (`--kind personal\|bearer\|auto`)  |
| `check`           | Validate token against the ClickUp `/user` endpoint     |
| `whoami`          | Show masked token, kind, source, config path            |
| `clear`           | Remove stored token (env vars are unaffected)           |

---

### `spec`

```bash
clickup spec fetch [--force]   # download + cache v2 & v3 specs (TTL 24h; auto on first use)
clickup spec show              # cache metadata, server URLs, endpoint counts
```

Specs are cached under `~/.clickup-cli/cache/`. Server URLs come from the spec's `servers[]` block.

---

### `list`

Browse every endpoint in the ClickUp API.

```bash
clickup list                           # all endpoints
clickup list --api v2                  # v2 only
clickup list --api v3                  # v3 only
clickup list --method POST             # only POSTs
clickup list --tag Tasks               # filter by OpenAPI tag
clickup list --search task             # substring match on path / summary / operationId
clickup list --format json             # JSON array (agent-friendly)
```

---

### `describe`

Inspect the full schema of an endpoint — parameters, request body, response codes — **without making any API call**. Useful for planning a `call` or letting an AI agent understand the contract before executing.

```bash
clickup describe GetTask
clickup describe CreateTask --format json   # full schema as JSON
clickup describe "task"                     # substring match (errors if ambiguous)
```

Output includes:
- Required vs optional parameters with types and examples
- Request body schema with required fields
- Response status codes

---

### `call`

Invoke a single endpoint by `operationId`, `METHOD /path`, or substring match.

```bash
clickup call GetAuthorizedUser
clickup call GetTask --param task_id=9hz
clickup call "GET /v2/task/{task_id}" --param task_id=9hz
clickup call CreateTask \
  --param list_id=901234567 \
  --body '{"name":"Fix bug","status":"open"}'
clickup call CreateTask --scaffold-body --body '{"name":"override"}'
clickup call GetTask --param task_id=MY-1 --custom-task-ids
clickup call GetAuthorizedUser --no-context     # skip workspace auto-discovery
clickup call GetAuthorizedUser --verbose        # print resolved URL, headers, body
clickup call GetAuthorizedUser --format json    # clean JSON envelope on stdout
```

| Flag                    | Description                                                          |
|-------------------------|----------------------------------------------------------------------|
| `--param key=value`     | Set a path / query / header param. Repeatable.                       |
| `--body <json>`         | Inline JSON request body.                                            |
| `--body-file <path>`    | JSON body from a file.                                               |
| `--scaffold-body`       | Seed body from spec example/schema, then merge `--body` on top.     |
| `--custom-task-ids`     | Inject `custom_task_ids=true&team_id=<workspace>` for task endpoints.|
| `--no-context`          | Skip workspace context auto-discovery.                               |
| `--format pretty\|json` | `json` → clean envelope on stdout, all chrome on stderr.            |
| `--verbose`             | Print resolved URL, query params, headers, and body before calling.  |

**Exit codes:** `0` ok · `2` skip (missing required params) · `3` 4xx · `4` 5xx · `5` network/timeout

---

### `probe`

Exercise many endpoints at once. Defaults to GET-only for safety.

```bash
clickup probe                                # all GETs, both API versions
clickup probe --api v2 --delay 800           # v2 only, 800ms between requests
clickup probe --tag Tasks                    # only "Tasks"-tagged endpoints
clickup probe --all --method POST --dry-run  # preview POSTs without calling
clickup probe --concurrency 3                # up to 3 parallel workers
clickup probe --format json                  # results as JSON
```

Results are persisted and can be re-rendered with `report`.

---

### `report`

```bash
clickup report                    # last probe run, table view
clickup report --status error     # filter by status (ok / error / skip / rate_limited / timeout)
clickup report --format json      # machine-readable
```

---

### Global options

```bash
clickup -q <command>   # --quiet: suppress all progress; data only on stdout
```

---

## Output and piping

All progress (spinners, labels, status lines) goes to **stderr**. Data always goes to **stdout**. Every command is safe to pipe:

```bash
clickup call GetAuthorizedUser --format json 2>/dev/null | jq '.body.user.email'
clickup list --format json 2>/dev/null | jq '.[].operationId'
```

Colors and spinners are auto-disabled when stdout is not a TTY, or when `NO_COLOR=1` or `CI=1` is set.

---

## Exit codes

| Code | Meaning                          |
|------|----------------------------------|
| `0`  | Success                          |
| `1`  | Usage error / unexpected failure |
| `2`  | Skipped — required params missing|
| `3`  | API returned 4xx                 |
| `4`  | API returned 5xx                 |
| `5`  | Network error / timeout          |

---

## Using with Claude Code / AI agents

### Setup (no interactive prompts needed)

```bash
export CLICKUP_TOKEN='pk_your_token_here'
```

### Discover → describe → call pattern

```bash
# Find relevant endpoints
clickup list --search "task" --format json 2>/dev/null | jq '.[].operationId'

# Inspect the contract
clickup describe CreateTask --format json 2>/dev/null \
  | jq '{required_params: [.parameters[] | select(.required) | .name], body: .requestBody}'

# Call and parse the result
clickup call CreateTask \
  --param list_id=901234567 \
  --body '{"name":"fix bug","status":"open"}' \
  --format json 2>/dev/null \
  | jq '{ok, httpStatus, id: .body.id}'

# Branch on exit code
clickup call GetTask --param task_id=abc --format json 2>/dev/null
# 0=ok · 2=missing params · 3=4xx · 4=5xx · 5=network
```

### Suppress all chrome

```bash
export NO_COLOR=1   # disable ANSI colors
export CI=1         # disable animated spinners
clickup --quiet call GetTask --param task_id=abc --format json
```

---

## How it works

| Layer | File | Role |
|-------|------|------|
| Loader | `src/spec/loader.ts` | Downloads v2 JSON + v3 YAML from ClickUp's developer portal; caches with TTL |
| Parser | `src/spec/parser.ts` | Dereferences `$ref`s via swagger-parser; builds typed `Endpoint` records; preserves param names verbatim |
| Param resolver | `src/runtime/params.ts` | Maps `WorkspaceContext` onto spec params via alias table (`workspace_id`/`workspaceId`/`team_id`/`teamId` → same value, etc.) |
| Body seeder | `src/runtime/body.ts` | Builds scaffold from spec `requestBody.example` or required schema properties |
| Context | `src/runtime/context.ts` | Auto-discovers workspace → space → folder → list → task, plus v3 docs/channels |
| Runner | `src/runtime/runner.ts` | Sends requests via axios; retries on `429` (honoring `Retry-After`) and transient network errors |
| Config | `src/store/config.ts` | `conf`-backed persistent store for token, kind, workspace context, probe results |
| HTTP client | `src/http/client.ts` | Per-server-URL axios instance; injects `Authorization` header; exponential backoff |

---

## Config locations

| Item              | Path                                                                  |
|-------------------|-----------------------------------------------------------------------|
| Token + settings  | Platform default via [`conf`](https://github.com/sindresorhus/conf)  |
| Spec cache        | `~/.clickup-cli/cache/`                                               |
| Last probe results| Same `conf` store, key `lastProbeResults`                             |

Run `clickup auth whoami` to print the exact config path on your machine.

---

## Local development

```bash
git clone https://github.com/w0l1d/clickup-CLI.git
cd clickup-CLI
npm install
npm run build
node dist/index.js --help

# Dev mode (ts-node, no build step):
npm run dev -- list --api v3
```

Link globally:

```bash
npm link          # makes `clickup` available on PATH
npm unlink -g     # remove the link
```

Publish:

```bash
npm version patch   # or minor / major — bumps package.json + creates git tag
npm publish         # prepublishOnly runs tsc automatically
```

CI runs on every push to `master`/`main` and on PRs (Node 18 + 20). A GitHub Release tag `v*` triggers the npm publish workflow.

---

## Security

- Tokens are never logged or printed in full — `whoami` shows only a masked value.
- `validateStatus: () => true` keeps non-2xx responses as data; error bodies never surface via stack traces.
- Only spec-declared server URLs are used for outbound requests; no user-controlled host injection.
- Run `npm audit` before publishing.

---

## License

MIT — see [LICENSE](./LICENSE).
