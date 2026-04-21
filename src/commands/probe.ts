import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { fetchSpecs } from '../core/specLoader';
import { parseSpecs } from '../core/specParser';
import { resolveWorkspaceContext } from '../core/paramResolver';
import { runEndpoint } from '../core/endpointRunner';
import { EndpointDef } from '../models/endpoint';
import { ProbeResult } from '../models/probeResult';
import { renderProbeReport, renderSummaryByTag } from '../output/probeReport';
import { setLastProbeResults, getApiKey } from '../core/config';

export function registerProbe(program: Command): void {
  program
    .command('probe')
    .description('Test ClickUp API endpoints with your credentials')
    .option('--tag <tag>', 'Only probe endpoints with this tag')
    .option('--method <method>', 'Filter by HTTP method (default: GET only)')
    .option('--api <version>', 'Filter by API version (v2 or v3)')
    .option('--all', 'Include non-GET endpoints (use with care!)')
    .option('--dry-run', 'Show what would be tested without calling the API')
    .option('--delay <ms>', 'Delay between requests in ms', '600')
    .option('--concurrency <n>', 'Parallel requests (max 3)', '1')
    .option('--format <format>', 'Output format: table or json', 'table')
    .action(async (opts: {
      tag?: string; method?: string; api?: string; all?: boolean;
      dryRun?: boolean; delay?: string; concurrency?: string; format?: string;
    }) => {
      if (!getApiKey()) {
        console.error(chalk.red('No API key set. Run: clickup-cli auth set <token>'));
        process.exit(1);
      }

      const spinner = ora('Loading spec...').start();
      let endpoints: EndpointDef[];
      try {
        const specs = await fetchSpecs();
        endpoints = await parseSpecs(specs.v2, specs.v3);
        spinner.stop();
      } catch (err: any) {
        spinner.fail('Failed to load spec');
        console.error(chalk.red(err.message));
        process.exit(1);
      }

      // Filter
      if (!opts.all) {
        endpoints = endpoints.filter(e => e.method === 'GET');
      }
      if (opts.method) endpoints = endpoints.filter(e => e.method === opts.method!.toUpperCase());
      if (opts.api) endpoints = endpoints.filter(e => e.apiVersion === opts.api);
      if (opts.tag) {
        const tag = opts.tag.toLowerCase();
        endpoints = endpoints.filter(e => e.tags.some(t => t.toLowerCase().includes(tag)));
      }

      console.log(chalk.bold(`\n  ${endpoints.length} endpoints to probe\n`));

      if (opts.dryRun) {
        for (const ep of endpoints) {
          console.log(`  ${chalk.green(ep.method.padEnd(7))} ${ep.apiVersion.padEnd(3)} ${ep.path}`);
        }
        console.log(chalk.dim('\n  Dry run — no requests made\n'));
        return;
      }

      // Resolve workspace context
      const ctxSpinner = ora('Resolving workspace context...').start();
      let ctx;
      try {
        ctx = await resolveWorkspaceContext();
        ctxSpinner.succeed('Workspace context resolved');
        if (ctx.workspaceId) console.log(chalk.dim(`  workspace_id=${ctx.workspaceId}`));
      } catch (err: any) {
        ctxSpinner.fail('Failed to resolve workspace context');
        console.error(chalk.red(err.message));
        process.exit(1);
      }

      const delayMs = parseInt(opts.delay || '600', 10);
      const results: ProbeResult[] = [];
      const probeSpinner = ora(`Probing 0/${endpoints.length}...`).start();

      for (let i = 0; i < endpoints.length; i++) {
        const ep = endpoints[i];
        probeSpinner.text = `Probing ${i + 1}/${endpoints.length}: ${ep.method} ${ep.path}`;

        const result = await runEndpoint(ep, ctx, {}, undefined, i > 0 ? delayMs : 0);
        results.push(result);
      }

      probeSpinner.succeed(`Probed ${results.length} endpoints`);

      const probedAt = new Date().toISOString();
      setLastProbeResults(results, probedAt);

      if (opts.format === 'json') {
        console.log(JSON.stringify(results, null, 2));
      } else {
        renderProbeReport(results, probedAt);
        renderSummaryByTag(results);
      }
    });
}
