import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs';
import { fetchSpecs, getCacheInfo } from '../spec/loader';
import { parseSpecs } from '../spec/parser';

export function registerSpec(program: Command): void {
  const spec = program.command('spec').description('Manage ClickUp OpenAPI spec cache');

  spec
    .command('fetch')
    .description('Download and cache ClickUp OpenAPI specs (v2 + v3)')
    .option('-f, --force', 'Force re-download even if cache is fresh')
    .action(async (opts: { force?: boolean }) => {
      const spinner = ora('Fetching ClickUp OpenAPI specs...').start();
      try {
        const specs = await fetchSpecs(opts.force);
        const docs = await parseSpecs(specs.v2, specs.v3);
        spinner.succeed('Specs fetched and cached');
        const info = getCacheInfo();
        console.log(`  ${chalk.bold('Cache dir:')}  ${info.cacheDir}`);
        console.log(`  ${chalk.bold('v2 fetched:')} ${info.meta.v2FetchedAt || 'n/a'}`);
        console.log(`  ${chalk.bold('v3 fetched:')} ${info.meta.v3FetchedAt || 'n/a'}`);
        for (const doc of docs) {
          console.log(
            `  ${chalk.bold(`${doc.version} servers:`)} ${doc.servers.join(', ')}  ${chalk.dim(`(${doc.endpoints.length} endpoints)`)}`
          );
        }
      } catch (err: any) {
        spinner.fail('Failed to fetch specs');
        console.error(chalk.red(`  ${err.message}`));
        process.exit(1);
      }
    });

  spec
    .command('show')
    .description('Show cached spec info')
    .action(async () => {
      const info = getCacheInfo();
      console.log(`\n  ${chalk.bold('Cache directory:')} ${info.cacheDir}\n`);
      const v2Exists = fs.existsSync(info.v2Path);
      const v3Exists = fs.existsSync(info.v3Path);
      console.log(
        `  v2 JSON: ${v2Exists ? chalk.green('cached') : chalk.yellow('not cached')}  ${
          info.meta.v2FetchedAt ? chalk.dim(`(${info.meta.v2FetchedAt})`) : ''
        }`
      );
      console.log(
        `  v3 YAML: ${v3Exists ? chalk.green('cached') : chalk.yellow('not cached')}  ${
          info.meta.v3FetchedAt ? chalk.dim(`(${info.meta.v3FetchedAt})`) : ''
        }`
      );
      if (!v2Exists || !v3Exists) {
        console.log(chalk.yellow('\n  Run: clickup-cli spec fetch'));
        return;
      }
      try {
        const v2Raw = fs.readFileSync(info.v2Path, 'utf8');
        const v3Raw = fs.readFileSync(info.v3Path, 'utf8');
        const docs = await parseSpecs(v2Raw, v3Raw);
        for (const doc of docs) {
          console.log(
            `\n  ${chalk.bold(`${doc.version}:`)} ${doc.endpoints.length} endpoints`
          );
          console.log(`    servers: ${doc.servers.join(', ')}`);
          const schemes = Object.keys(doc.securitySchemes);
          if (schemes.length) console.log(`    security schemes: ${schemes.join(', ')}`);
        }
      } catch (err: any) {
        console.error(chalk.red(`  Failed to parse cached specs: ${err.message}`));
      }
    });
}
