import { Command } from 'commander';
import chalk from 'chalk';
import { getLastProbeResults, getLastProbedAt } from '../store/config';
import { renderProbeReport, renderSummaryByTag } from '../output/probeReport';
import { setJsonMode, stdout } from '../output/ui';

export function registerReport(program: Command): void {
  program
    .command('report')
    .description('Show results from the last probe run')
    .option('--format <format>', 'Output format: table or json', 'table')
    .option('--status <status>', 'Filter by status (ok, error, skip, rate_limited, timeout)')
    .action((opts: { format?: string; status?: string }) => {
      if (opts.format === 'json') setJsonMode(true);

      let results = getLastProbeResults();
      const probedAt = getLastProbedAt();

      if (!results || results.length === 0) {
        process.stderr.write(chalk.yellow('No probe results found. Run: clickup probe\n'));
        return;
      }

      if (opts.status) {
        results = results.filter((r) => r.status === opts.status);
      }

      if (opts.format === 'json') {
        stdout(JSON.stringify(results, null, 2));
      } else {
        renderProbeReport(results, probedAt);
        if (!opts.status) renderSummaryByTag(results);
      }
    });
}
