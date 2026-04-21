import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs';
import { fetchSpecs, getCacheInfo } from '../core/specLoader';

export function registerSpec(program: Command): void {
  const spec = program.command('spec').description('Manage ClickUp OpenAPI spec cache');

  spec
    .command('fetch')
    .description('Download and cache ClickUp OpenAPI specs (v2 + v3)')
    .option('-f, --force', 'Force re-download even if cache is fresh')
    .action(async (opts: { force?: boolean }) => {
      const spinner = ora('Fetching ClickUp OpenAPI specs...').start();
      try {
        await fetchSpecs(opts.force);
        spinner.succeed('Specs fetched and cached');
        const info = getCacheInfo();
        console.log(`  ${chalk.bold('Cache dir:')} ${info.cacheDir}`);
        console.log(`  ${chalk.bold('v2 fetched:')} ${info.meta.v2FetchedAt || 'n/a'}`);
        console.log(`  ${chalk.bold('v3 fetched:')} ${info.meta.v3FetchedAt || 'n/a'}`);
      } catch (err: any) {
        spinner.fail('Failed to fetch specs');
        console.error(chalk.red(`  ${err.message}`));
        process.exit(1);
      }
    });

  spec
    .command('show')
    .description('Show cached spec info')
    .action(() => {
      const info = getCacheInfo();
      console.log(`\n  ${chalk.bold('Cache directory:')} ${info.cacheDir}\n`);
      const v2Exists = fs.existsSync(info.v2Path);
      const v3Exists = fs.existsSync(info.v3Path);
      console.log(`  v2 JSON: ${v2Exists ? chalk.green('cached') : chalk.yellow('not cached')}  ${info.meta.v2FetchedAt ? chalk.dim(`(${info.meta.v2FetchedAt})`) : ''}`);
      console.log(`  v3 YAML: ${v3Exists ? chalk.green('cached') : chalk.yellow('not cached')}  ${info.meta.v3FetchedAt ? chalk.dim(`(${info.meta.v3FetchedAt})`) : ''}`);
      if (!v2Exists && !v3Exists) {
        console.log(chalk.yellow('\n  Run: clickup-cli spec fetch'));
      }
    });
}
