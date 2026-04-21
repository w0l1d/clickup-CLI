import Table from 'cli-table3';
import chalk from 'chalk';
import { ProbeResult } from '../store/config';

function statusCell(r: ProbeResult): string {
  const s = r.httpStatus;
  if (r.status === 'skip') return chalk.dim('SKIP');
  if (r.status === 'timeout') return chalk.magenta('TIMEOUT');
  if (r.status === 'rate_limited') return chalk.yellow('429');
  if (!s) return chalk.dim('—');
  if (s >= 200 && s < 300) return chalk.green(String(s));
  if (s >= 400 && s < 500) return chalk.yellow(String(s));
  return chalk.red(String(s));
}

export function renderProbeReport(results: ProbeResult[], probedAt?: string): void {
  if (probedAt) {
    console.log(chalk.dim(`\n  Probed at: ${new Date(probedAt).toLocaleString()}\n`));
  }

  const table = new Table({
    head: [
      chalk.bold('Status'),
      chalk.bold('Method'),
      chalk.bold('Path'),
      chalk.bold('Duration'),
      chalk.bold('Details'),
    ],
    colWidths: [9, 9, 52, 11, 45],
    wordWrap: true,
    style: { head: [], border: [] },
  });

  for (const r of results) {
    const dur = r.durationMs != null ? `${r.durationMs}ms` : '—';
    const details = r.status === 'skip'
      ? chalk.dim(r.errorMessage || '')
      : (r.errorMessage || r.responseSnippet || '');
    table.push([
      statusCell(r),
      r.endpoint.method,
      r.resolvedUrl || r.endpoint.path,
      dur,
      String(details).slice(0, 80),
    ]);
  }
  console.log(table.toString());

  const ok = results.filter(r => r.status === 'ok').length;
  const err = results.filter(r => r.status === 'error' || r.status === 'timeout').length;
  const skip = results.filter(r => r.status === 'skip').length;
  const rl = results.filter(r => r.status === 'rate_limited').length;
  console.log(
    `\n  ${chalk.green(`${ok} ok`)}  ${chalk.yellow(`${rl} rate-limited`)}  ${chalk.red(`${err} errors`)}  ${chalk.dim(`${skip} skipped`)}\n`
  );
}

export function renderSummaryByTag(results: ProbeResult[]): void {
  const byTag: Record<string, ProbeResult[]> = {};
  for (const r of results) {
    const tags = r.endpoint.tags.length ? r.endpoint.tags : ['(untagged)'];
    for (const tag of tags) {
      if (!byTag[tag]) byTag[tag] = [];
      byTag[tag].push(r);
    }
  }

  console.log(chalk.bold('\n  Results by tag:\n'));
  for (const [tag, tagResults] of Object.entries(byTag).sort()) {
    const ok = tagResults.filter(r => r.status === 'ok').length;
    const total = tagResults.filter(r => r.status !== 'skip').length;
    const skip = tagResults.filter(r => r.status === 'skip').length;
    console.log(
      `  ${chalk.cyan(tag.padEnd(25))} ${chalk.green(`${ok}/${total} ok`)}  ${chalk.dim(`${skip} skipped`)}`
    );
  }
  console.log();
}
