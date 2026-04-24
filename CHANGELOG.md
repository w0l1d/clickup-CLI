# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-04-24

### Added
- **`auth login`** — guided onboarding that opens the browser to `https://app.clickup.com/settings/apps`, prompts for the token with hidden input, and validates it immediately.
- **`describe <endpoint>`** — shows full parameter list (required/optional, types, examples), request body schema, and response codes without making any API call. Supports `--format json` for machine-readable output.
- **Env-var token auth** — `CLICKUP_TOKEN`, `CLICKUP_API_TOKEN`, or `CLICKUP_API_KEY` override the stored config token. `CLICKUP_TOKEN_KIND` overrides the token kind. `auth whoami` reports the active source (`env` vs `config`).
- **Global `--quiet` / `-q` flag** — suppresses all progress output; only data hits stdout.

### Changed
- All progress output (spinners, labels, status lines) now goes to **stderr**; only data goes to **stdout**. This makes every command safe to pipe without `2>/dev/null`.
- **`call --format json`** emits a clean JSON envelope `{ok, status, httpStatus, durationMs, url, error, body}` on stdout with no surrounding chrome.
- **TTY detection** — spinners and ANSI colors are automatically disabled when stdout is not a TTY, or when `NO_COLOR` or `CI` env vars are set.
- **Consistent exit codes** for `call`: `0` ok, `2` skip/missing params, `3` 4xx, `4` 5xx, `5` network error/timeout.
- No-token error now shows the token generation URL, step-by-step instructions, and env-var hint instead of a bare error message.

## [0.1.0] - 2026-04-21

Initial public release.

### Added
- Spec-driven architecture: endpoints, servers, parameters, and security schemes are pulled verbatim from the ClickUp v2 and v3 OpenAPI documents.
- `auth set | check | whoami | clear` with support for personal (`pk_`) and OAuth bearer tokens, plus an `auto` mode that picks the right `Authorization` header based on the token shape.
- `spec fetch | show` with TTL-based local caching under `~/.clickup-cli/cache/`.
- `list` with filters (`--api`, `--method`, `--tag`, `--search`) and `table`/`json` output.
- `call <endpoint>` accepting `operationId`, `METHOD /path`, or substring match; supports `--param`, `--body`, `--body-file`, `--scaffold-body`, `--custom-task-ids`, `--no-context`, and `--verbose`.
- `probe` with GET-by-default, `--all` opt-in for mutating methods, `--delay`, `--concurrency` (capped at 3), `--dry-run`, and persistence of results for later reporting.
- `report` with status filtering for the most recent probe run.
- Workspace context auto-discovery (workspace → space → folder → list → first task, plus best-effort v3 doc/channel enrichment) feeding a param alias table that bridges snake_case and camelCase naming across v2/v3.
- `429` retries honoring the `Retry-After` header; transient network errors retried with exponential backoff.
