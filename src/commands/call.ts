import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import { fetchSpecs } from '../spec/loader';
import { allEndpoints, parseSpecs } from '../spec/parser';
import { Endpoint } from '../spec/model';
import { resolveWorkspaceContext } from '../runtime/context';
import { mergeBody, seedBody } from '../runtime/body';
import { fillPathAndQuery } from '../runtime/params';
import { runEndpoint } from '../runtime/runner';
import { printJson } from '../output/json';
import { getApiToken, WorkspaceContext } from '../store/config';
import { spinner, isJsonMode, setJsonMode, info, err, stdout, note } from '../output/ui';
import { printTokenMissingHelp } from '../output/onboarding';

// 0=ok, 2=skip/missing-params, 3=4xx, 4=5xx, 5=network/timeout
function exitCodeFor(status: string, httpStatus?: number): number {
  if (status === 'ok') return 0;
  if (status === 'skip') return 2;
  if (status === 'timeout') return 5;
  if (httpStatus != null) {
    if (httpStatus >= 400 && httpStatus < 500) return 3;
    if (httpStatus >= 500) return 4;
  }
  return 5;
}

function findEndpoint(endpoints: Endpoint[], query: string): Endpoint | Endpoint[] {
  const exact = endpoints.find((e) => e.operationId === query);
  if (exact) return exact;

  const methodPath = query.match(/^(GET|POST|PUT|PATCH|DELETE)\s+(.+)$/i);
  if (methodPath) {
    const hit = endpoints.find(
      (e) => e.method === methodPath[1].toUpperCase() && e.path === methodPath[2]
    );
    if (hit) return hit;
  }

  const q = query.toLowerCase();
  return endpoints.filter(
    (e) => e.operationId.toLowerCase().includes(q) || e.path.toLowerCase().includes(q)
  );
}

export function registerCall(program: Command): void {
  program
    .command('call <endpoint>')
    .description('Call a specific endpoint by operationId or "METHOD /path"')
    .option('--param <kv...>', 'Path/query/header param as key=value (repeatable)')
    .option('--body <json>', 'Request body as JSON string')
    .option('--body-file <path>', 'Request body from a JSON file')
    .option('--scaffold-body', 'Seed request body from spec example/schema')
    .option('--custom-task-ids', 'Treat task_id as a custom ID (adds custom_task_ids=true&team_id)')
    .option('--no-context', 'Skip workspace context resolution')
    .option('--format <format>', 'Output format: pretty or json', 'pretty')
    .option('--verbose', 'Show resolved request + full response')
    .action(async (endpointQuery: string, opts: {
      param?: string[];
      body?: string;
      bodyFile?: string;
      scaffoldBody?: boolean;
      customTaskIds?: boolean;
      context?: boolean;
      format?: string;
      verbose?: boolean;
    }) => {
      if (opts.format === 'json') setJsonMode(true);

      if (!getApiToken()) {
        printTokenMissingHelp();
        process.exit(1);
      }

      const sp = spinner('Loading spec...').start();
      let endpoints: Endpoint[];
      let docs: any;
      try {
        const specs = await fetchSpecs();
        docs = await parseSpecs(specs.v2, specs.v3);
        endpoints = allEndpoints(docs);
        sp.stop();
      } catch (e: any) {
        sp.fail('Failed to load spec');
        err(e.message);
        process.exit(1);
      }

      const found = findEndpoint(endpoints, endpointQuery);
      if (Array.isArray(found)) {
        if (found.length === 0) {
          err(`Endpoint not found: ${endpointQuery}`);
          note('Use: clickup list --search <query>');
          process.exit(1);
        }
        if (found.length > 1) {
          process.stderr.write(chalk.yellow(`\nMultiple matches for "${endpointQuery}":\n\n`));
          for (const m of found) {
            process.stderr.write(`  ${chalk.green(m.method.padEnd(7))} ${m.operationId}  ${chalk.dim(m.path)}\n`);
          }
          process.stderr.write('\nUse the exact operationId.\n');
          process.exit(1);
        }
      }
      const ep = Array.isArray(found) ? found[0] : found;

      info(`\n  ${chalk.bold('Calling:')} ${chalk.green(ep.method)} ${ep.path}`);
      note(`  Operation: ${ep.operationId}  (${ep.apiVersion})\n`);

      const overrides: Record<string, string> = {};
      for (const kv of opts.param || []) {
        const idx = kv.indexOf('=');
        if (idx < 0) {
          err(`Invalid --param: ${kv} (expected key=value)`);
          process.exit(1);
        }
        overrides[kv.slice(0, idx)] = kv.slice(idx + 1);
      }
      if (opts.customTaskIds) overrides['custom_task_ids'] = 'true';

      let body: unknown;
      if (opts.bodyFile) {
        try {
          body = JSON.parse(fs.readFileSync(opts.bodyFile, 'utf8'));
        } catch (e: any) {
          err(`Failed to read --body-file: ${e.message}`);
          process.exit(1);
        }
      }
      if (opts.body) {
        try {
          body = JSON.parse(opts.body);
        } catch {
          err('Invalid JSON in --body');
          process.exit(1);
        }
      }
      if (opts.scaffoldBody) body = mergeBody(seedBody(ep), body);

      let ctx: WorkspaceContext = {};
      if (opts.context !== false) {
        const ctxSp = spinner('Resolving workspace context...').start();
        try {
          ctx = await resolveWorkspaceContext(docs);
          ctxSp.stop();
        } catch (e: any) {
          ctxSp.fail('Failed to resolve workspace context');
          err(e.message);
          process.exit(1);
        }
      }

      if (opts.verbose) {
        const filled = fillPathAndQuery(ep, ctx, overrides);
        process.stderr.write(chalk.bold('  Request:\n'));
        process.stderr.write(`    ${ep.method} ${ep.serverUrl}${filled.url}\n`);
        if (Object.keys(filled.query).length) process.stderr.write(`    query: ${JSON.stringify(filled.query)}\n`);
        if (Object.keys(filled.headers).length) process.stderr.write(`    headers: ${JSON.stringify(filled.headers)}\n`);
        if (body !== undefined) process.stderr.write(`    body: ${JSON.stringify(body)}\n`);
        process.stderr.write('\n');
      }

      const callSp = spinner('Calling endpoint...').start();
      const result = await runEndpoint(ep, ctx, { overrides, body });
      callSp.stop();

      const exitCode = exitCodeFor(result.status, result.httpStatus);

      if (isJsonMode()) {
        let parsedBody: unknown = null;
        if (result.responseSnippet) {
          try { parsedBody = JSON.parse(result.responseSnippet); } catch { parsedBody = result.responseSnippet; }
        }
        stdout(JSON.stringify({
          ok: result.status === 'ok',
          status: result.status,
          httpStatus: result.httpStatus ?? null,
          durationMs: result.durationMs ?? null,
          url: result.resolvedUrl ? `${ep.serverUrl}${result.resolvedUrl}` : null,
          error: result.errorMessage ?? null,
          body: parsedBody,
        }));
        process.exit(exitCode);
      }

      const statusColor =
        result.status === 'ok' ? chalk.green :
        result.status === 'skip' ? chalk.dim :
        chalk.red;
      const statusStr = result.httpStatus != null ? String(result.httpStatus) : result.status;
      process.stderr.write(`  ${chalk.bold('Status:')}   ${statusColor(statusStr)}\n`);
      if (result.durationMs != null) process.stderr.write(`  ${chalk.bold('Duration:')} ${result.durationMs}ms\n`);
      if (result.resolvedUrl) process.stderr.write(`  ${chalk.bold('URL:')}      ${ep.serverUrl}${result.resolvedUrl}\n\n`);
      if (result.errorMessage) err(`  ${result.errorMessage}`);

      if (result.responseSnippet) {
        try {
          const parsed = JSON.parse(result.responseSnippet);
          printJson(parsed);
        } catch {
          stdout(result.responseSnippet);
        }
      }

      process.exit(exitCode);
    });
}