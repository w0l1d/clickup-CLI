import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
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
      if (!getApiToken()) {
        console.error(chalk.red('No token set. Run: clickup-cli auth set <token>'));
        process.exit(1);
      }

      const spinner = ora('Loading spec...').start();
      let endpoints: Endpoint[];
      let docs;
      try {
        const specs = await fetchSpecs();
        docs = await parseSpecs(specs.v2, specs.v3);
        endpoints = allEndpoints(docs);
        spinner.stop();
      } catch (err: any) {
        spinner.fail('Failed to load spec');
        console.error(chalk.red(err.message));
        process.exit(1);
      }

      const found = findEndpoint(endpoints, endpointQuery);
      if (Array.isArray(found)) {
        if (found.length === 0) {
          console.error(chalk.red(`Endpoint not found: ${endpointQuery}`));
          console.log('Use: clickup-cli list --search <query>');
          process.exit(1);
        }
        if (found.length > 1) {
          console.log(chalk.yellow(`Multiple matches for "${endpointQuery}":\n`));
          for (const m of found) {
            console.log(`  ${chalk.green(m.method.padEnd(7))} ${m.operationId}  ${chalk.dim(m.path)}`);
          }
          console.log('\nUse the exact operationId.');
          process.exit(1);
        }
      }
      const ep = Array.isArray(found) ? found[0] : found;

      console.log(`\n  ${chalk.bold('Calling:')} ${chalk.green(ep.method)} ${ep.path}`);
      console.log(`  ${chalk.dim(`Operation: ${ep.operationId}  (${ep.apiVersion})`)}\n`);

      const overrides: Record<string, string> = {};
      for (const kv of opts.param || []) {
        const idx = kv.indexOf('=');
        if (idx < 0) {
          console.error(chalk.red(`Invalid --param: ${kv} (expected key=value)`));
          process.exit(1);
        }
        overrides[kv.slice(0, idx)] = kv.slice(idx + 1);
      }
      if (opts.customTaskIds) overrides['custom_task_ids'] = 'true';

      let body: unknown;
      if (opts.bodyFile) {
        try {
          body = JSON.parse(fs.readFileSync(opts.bodyFile, 'utf8'));
        } catch (err: any) {
          console.error(chalk.red(`Failed to read --body-file: ${err.message}`));
          process.exit(1);
        }
      }
      if (opts.body) {
        try {
          body = JSON.parse(opts.body);
        } catch {
          console.error(chalk.red('Invalid JSON in --body'));
          process.exit(1);
        }
      }
      if (opts.scaffoldBody) {
        const seed = seedBody(ep);
        body = mergeBody(seed, body);
      }

      let ctx: WorkspaceContext = {};
      if (opts.context !== false) {
        const ctxSpinner = ora('Resolving workspace context...').start();
        try {
          ctx = await resolveWorkspaceContext(docs);
          ctxSpinner.stop();
        } catch (err: any) {
          ctxSpinner.fail('Failed to resolve workspace context');
          console.error(chalk.red(err.message));
          process.exit(1);
        }
      }

      if (opts.verbose) {
        const filled = fillPathAndQuery(ep, ctx, overrides);
        console.log(chalk.bold('  Request:'));
        console.log(`    ${ep.method} ${ep.serverUrl}${filled.url}`);
        if (Object.keys(filled.query).length) {
          console.log(`    query: ${JSON.stringify(filled.query)}`);
        }
        if (Object.keys(filled.headers).length) {
          console.log(`    headers: ${JSON.stringify(filled.headers)}`);
        }
        if (body !== undefined) {
          console.log(`    body: ${JSON.stringify(body)}`);
        }
        console.log();
      }

      const callSpinner = ora('Calling endpoint...').start();
      const result = await runEndpoint(ep, ctx, { overrides, body });
      callSpinner.stop();

      const statusStr = result.httpStatus != null ? String(result.httpStatus) : result.status;
      const statusColor =
        result.status === 'ok' ? chalk.green : result.status === 'skip' ? chalk.dim : chalk.red;
      console.log(`  ${chalk.bold('Status:')}   ${statusColor(statusStr)}`);
      if (result.durationMs != null) console.log(`  ${chalk.bold('Duration:')} ${result.durationMs}ms`);
      if (result.resolvedUrl) console.log(`  ${chalk.bold('URL:')}      ${ep.serverUrl}${result.resolvedUrl}\n`);

      if (result.errorMessage) {
        console.error(chalk.red(`  ${result.errorMessage}`));
      }

      if (result.responseSnippet) {
        try {
          const parsed = JSON.parse(result.responseSnippet);
          if (opts.format === 'pretty') printJson(parsed);
          else console.log(JSON.stringify(parsed, null, 2));
        } catch {
          console.log(result.responseSnippet);
        }
      }

      if (result.status === 'error' || result.status === 'timeout') {
        process.exit(1);
      }
    });
}
