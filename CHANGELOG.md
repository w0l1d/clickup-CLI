# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
