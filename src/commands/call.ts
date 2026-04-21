import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { fetchSpecs } from '../core/specLoader';
import { parseSpecs } from '../core/specParser';
import { resolveWorkspaceContext } from '../core/paramResolver';
import { runEndpoint } from '../core/endpointRunner';
import { printJson } from '../output/jsonPrinter';
import { getApiKey } from '../core/config';

export function registerCall(program: Command): void {
  program
    .command('call <endpoint>')
    .description('Call a specific endpoint by operation ID or "METHOD /path"')
    .option('--param <kv...>', 'Path/query param as key=value')
    .option('--body <json>', 'Request body as JSON string')
    .option('--format <format>', 'Output format: pretty or json', 'pretty')
    .option('--verbose', 'Show response headers and full details')
    .action(async (endpoint: string, opts: {
      param?: string[]; body?: string; format?: string; verbose?: boolean;
    }) => {
      if (!getApiKey()) {
        console.error(chalk.red('No API key set. Run: clickup-cli auth set <token>'));
        process.exit(1);
      }

      const spinner = ora('Loading spec...').start();
      let endpoints;
      try {
        const specs = await fetchSpecs();
        endpoints = await parseSpecs(specs.v2, specs.v3);
        spinner.stop();
      } catch (err: any) {
        spinner.fail('Failed to load spec');
        console.error(chalk.red(err.message));
        process.exit(1);
      }

      // Find endpoint by operationId or "METHOD /path"
      let found = endpoints.find(e => e.operationId === endpoint);
      if (!found) {
        // Try "GET /v2/user" style
        const match = endpoint.match(/^(GET|POST|PUT|PATCH|DELETE)\s+(.+)$/i);
        if (match) {
          found = endpoints.find(e => e.method === match[1].toUpperCase() && e.path === match[2]);
        }
      }
      if (!found) {
        // Fuzzy search
        const q = endpoint.toLowerCase();
        const matches = endpoints.filter(e =>
          e.operationId.toLowerCase().includes(q) || e.path.toLowerCase().includes(q)
        );
        if (matches.length === 0) {
          console.error(chalk.red(`Endpoint not found: ${endpoint}`));
          console.log('Use: clickup-cli list --search <query>');
          process.exit(1);
        }
        if (matches.length > 1) {
          console.log(chalk.yellow(`Multiple matches found for "${endpoint}":\n`));
          for (const m of matches) {
            console.log(`  ${chalk.green(m.method.padEnd(7))} ${m.operationId}  ${chalk.dim(m.path)}`);
          }
          console.log('\nPlease use the exact operation ID.');
          process.exit(1);
        }
        found = matches[0];
      }

      console.log(`\n  ${chalk.bold('Calling:')} ${chalk.green(found.method)} ${found.path}`);
      console.log(`  ${chalk.dim(`Operation: ${found.operationId}`)}\n`);

      // Parse extra params
      const extraParams: Record<string, string> = {};
      for (const kv of (opts.param || [])) {
        const [k, ...v] = kv.split('=');
        extraParams[k] = v.join('=');
      }

      // Parse body
      let body: unknown;
      if (opts.body) {
        try {
          body = JSON.parse(opts.body);
        } catch {
          console.error(chalk.red('Invalid JSON body'));
          process.exit(1);
        }
      }

      const ctxSpinner = ora('Resolving workspace context...').start();
      const ctx = await resolveWorkspaceContext();
      ctxSpinner.stop();

      const callSpinner = ora('Calling endpoint...').start();
      const result = await runEndpoint(found, ctx, extraParams, body);
      callSpinner.stop();

      const statusStr = result.httpStatus ? String(result.httpStatus) : result.status;
      const statusColor = result.status === 'ok' ? chalk.green : chalk.red;
      console.log(`  ${chalk.bold('Status:')} ${statusColor(statusStr)}`);
      if (result.durationMs != null) console.log(`  ${chalk.bold('Duration:')} ${result.durationMs}ms`);
      if (result.resolvedUrl) console.log(`  ${chalk.bold('URL:')} ${result.resolvedUrl}\n`);

      if (result.errorMessage) {
        console.error(chalk.red(`  Error: ${result.errorMessage}`));
      }

      if (result.responseSnippet) {
        try {
          const parsed = JSON.parse(result.responseSnippet);
          if (opts.format === 'pretty') {
            printJson(parsed);
          } else {
            console.log(JSON.stringify(parsed, null, 2));
          }
        } catch {
          console.log(result.responseSnippet);
        }
      }
    });
}
