import { Command } from 'commander';
import chalk from 'chalk';
import { fetchSpecs } from '../spec/loader';
import { allEndpoints, parseSpecs } from '../spec/parser';
import { Endpoint } from '../spec/model';
import { resolveWorkspaceContext } from '../runtime/context';
import { runEndpoint } from '../runtime/runner';
import { renderProbeReport, renderSummaryByTag } from '../output/probeReport';
import { getApiToken, ProbeResult, setLastProbeResults, WorkspaceContext } from '../store/config';
import { spinner, err, note, stdout } from '../output/ui';
import { printTokenMissingHelp } from '../output/onboarding';

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

      if (!opts.all) endpoints = endpoints.filter((e) => e.method === 'GET');
      if (opts.method) endpoints = endpoints.filter((e) => e.method === opts.method!.toUpperCase());
      if (opts.api) endpoints = endpoints.filter((e) => e.apiVersion === opts.api);
      if (opts.tag) {
        const tag = opts.tag.toLowerCase();
        endpoints = endpoints.filter((e) => e.tags.some((t) => t.toLowerCase().includes(tag)));
      }

      process.stderr.write(chalk.bold(`\n  ${endpoints.length} endpoints to probe\n\n`));

      if (opts.dryRun) {
        for (const ep of endpoints) {
          process.stderr.write(`  ${chalk.green(ep.method.padEnd(7))} ${ep.apiVersion.padEnd(3)} ${ep.path}\n`);
        }
        note('\n  Dry run — no requests made\n');
        return;
      }

      const ctxSp = spinner('Resolving workspace context...').start();
      let ctx: WorkspaceContext;
      try {
        ctx = await resolveWorkspaceContext(docs);
        ctxSp.succeed('Workspace context resolved');
        if (ctx.workspaceId) note(`  workspaceId=${ctx.workspaceId}`);
      } catch (e: any) {
        ctxSp.fail('Failed to resolve workspace context');
        err(e.message);
        process.exit(1);
      }

      const delayMs = parseInt(opts.delay || '600', 10);
      const concurrency = Math.max(1, Math.min(3, parseInt(opts.concurrency || '1', 10)));
      const results: ProbeResult[] = [];
      const probeSp = spinner(`Probing 0/${endpoints.length}...`).start();

      let done = 0;
      async function worker(slice: Endpoint[]): Promise<void> {
        for (let i = 0; i < slice.length; i++) {
          const ep = slice[i];
          const result = await runEndpoint(ep, ctx, { delayMs: i > 0 ? delayMs : 0 });
          results.push(result);
          done += 1;
          probeSp.text = `Probing ${done}/${endpoints.length}: ${ep.method} ${ep.path}`;
        }
      }

      const slices: Endpoint[][] = Array.from({ length: concurrency }, () => []);
      endpoints.forEach((ep, i) => slices[i % concurrency].push(ep));
      await Promise.all(slices.map(worker));

      probeSp.succeed(`Probed ${results.length} endpoints`);

      const probedAt = new Date().toISOString();
      setLastProbeResults(results, probedAt);

      if (opts.format === 'json') {
        stdout(JSON.stringify(results, null, 2));
      } else {
        renderProbeReport(results, probedAt);
        renderSummaryByTag(results);
      }
    });
}
