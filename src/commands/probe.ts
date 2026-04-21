import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { fetchSpecs } from '../spec/loader';
import { allEndpoints, parseSpecs } from '../spec/parser';
import { Endpoint } from '../spec/model';
import { resolveWorkspaceContext } from '../runtime/context';
import { runEndpoint } from '../runtime/runner';
import { renderProbeReport, renderSummaryByTag } from '../output/probeReport';
import { getApiToken, ProbeResult, setLastProbeResults, WorkspaceContext } from '../store/config';

export function registerProbe(program: Command): void {
  program
    .command('probe')
    .description('Test ClickUp API endpoints with your credentials')
    .option('--tag <tag>', 'Only probe endpoints with this tag')
    .option('--method <method>', 'Filter by HTTP method')
    .option('--api <version>', 'Filter by API version (v2 or v3)')
    .option('--all', 'Include non-GET endpoints (use with care!)')
    .option('--dry-run', 'Show what would be tested without calling the API')
    .option('--delay <ms>', 'Delay between requests in ms', '600')
    .option('--concurrency <n>', 'Parallel requests (capped at 3)', '1')
    .option('--format <format>', 'Output format: table or json', 'table')
    .action(async (opts: {
      tag?: string; method?: string; api?: string; all?: boolean;
      dryRun?: boolean; delay?: string; concurrency?: string; format?: string;
    }) => {
      if (!getApiToken()) {
        console.error(chalk.red('No token set. Run: clickup auth set <token>'));
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

      if (!opts.all) endpoints = endpoints.filter((e) => e.method === 'GET');
      if (opts.method) endpoints = endpoints.filter((e) => e.method === opts.method!.toUpperCase());
      if (opts.api) endpoints = endpoints.filter((e) => e.apiVersion === opts.api);
      if (opts.tag) {
        const tag = opts.tag.toLowerCase();
        endpoints = endpoints.filter((e) => e.tags.some((t) => t.toLowerCase().includes(tag)));
      }

      console.log(chalk.bold(`\n  ${endpoints.length} endpoints to probe\n`));

      if (opts.dryRun) {
        for (const ep of endpoints) {
          console.log(`  ${chalk.green(ep.method.padEnd(7))} ${ep.apiVersion.padEnd(3)} ${ep.path}`);
        }
        console.log(chalk.dim('\n  Dry run — no requests made\n'));
        return;
      }

      const ctxSpinner = ora('Resolving workspace context...').start();
      let ctx: WorkspaceContext;
      try {
        ctx = await resolveWorkspaceContext(docs);
        ctxSpinner.succeed('Workspace context resolved');
        if (ctx.workspaceId) console.log(chalk.dim(`  workspaceId=${ctx.workspaceId}`));
      } catch (err: any) {
        ctxSpinner.fail('Failed to resolve workspace context');
        console.error(chalk.red(err.message));
        process.exit(1);
      }

      const delayMs = parseInt(opts.delay || '600', 10);
      const concurrency = Math.max(1, Math.min(3, parseInt(opts.concurrency || '1', 10)));
      const results: ProbeResult[] = [];
      const probeSpinner = ora(`Probing 0/${endpoints.length}...`).start();

      let done = 0;
      async function worker(slice: Endpoint[]): Promise<void> {
        for (let i = 0; i < slice.length; i++) {
          const ep = slice[i];
          const result = await runEndpoint(ep, ctx, { delayMs: i > 0 ? delayMs : 0 });
          results.push(result);
          done += 1;
          probeSpinner.text = `Probing ${done}/${endpoints.length}: ${ep.method} ${ep.path}`;
        }
      }

      // Round-robin split for concurrency
      const slices: Endpoint[][] = Array.from({ length: concurrency }, () => []);
      endpoints.forEach((ep, i) => slices[i % concurrency].push(ep));
      await Promise.all(slices.map(worker));

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
