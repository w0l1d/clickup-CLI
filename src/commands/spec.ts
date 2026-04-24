import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import { fetchSpecs, getCacheInfo } from '../spec/loader';
import { parseSpecs } from '../spec/parser';
import { spinner, info, err } from '../output/ui';

export function registerSpec(program: Command): void {
  const spec = program.command('spec').description('Manage ClickUp OpenAPI spec cache');

  spec
    .command('fetch')
    .description('Download and cache ClickUp OpenAPI specs (v2 + v3)')
    .option('-f, --force', 'Force re-download even if cache is fresh')
    .action(async (opts: { force?: boolean }) => {
      const sp = spinner('Fetching ClickUp OpenAPI specs...').start();
      try {
        const specs = await fetchSpecs(opts.force);
        const docs = await parseSpecs(specs.v2, specs.v3);
        sp.succeed('Specs fetched and cached');
        const cinfo = getCacheInfo();
        info(`  ${chalk.bold('Cache dir:')}  ${cinfo.cacheDir}`);
        info(`  ${chalk.bold('v2 fetched:')} ${cinfo.meta.v2FetchedAt || 'n/a'}`);
        info(`  ${chalk.bold('v3 fetched:')} ${cinfo.meta.v3FetchedAt || 'n/a'}`);
        for (const doc of docs) {
          info(`  ${chalk.bold(`${doc.version} servers:`)} ${doc.servers.join(', ')}  ${chalk.dim(`(${doc.endpoints.length} endpoints)`)}`);
        }
      } catch (e: any) {
        sp.fail('Failed to fetch specs');
        err(`  ${e.message}`);
        process.exit(1);
      }
    });

  spec
    .command('show')
    .description('Show cached spec info')
    .action(async () => {
      const cinfo = getCacheInfo();
      info(`\n  ${chalk.bold('Cache directory:')} ${cinfo.cacheDir}\n`);
      const v2Exists = fs.existsSync(cinfo.v2Path);
      const v3Exists = fs.existsSync(cinfo.v3Path);
      info(`  v2 JSON: ${v2Exists ? chalk.green('cached') : chalk.yellow('not cached')}  ${cinfo.meta.v2FetchedAt ? chalk.dim(`(${cinfo.meta.v2FetchedAt})`) : ''}`);
      info(`  v3 YAML: ${v3Exists ? chalk.green('cached') : chalk.yellow('not cached')}  ${cinfo.meta.v3FetchedAt ? chalk.dim(`(${cinfo.meta.v3FetchedAt})`) : ''}`);
      if (!v2Exists || !v3Exists) {
        process.stderr.write(chalk.yellow('\n  Run: clickup spec fetch\n'));
        return;
      }
      try {
        const v2Raw = fs.readFileSync(cinfo.v2Path, 'utf8');
        const v3Raw = fs.readFileSync(cinfo.v3Path, 'utf8');
        const docs = await parseSpecs(v2Raw, v3Raw);
        for (const doc of docs) {
          info(`\n  ${chalk.bold(`${doc.version}:`)} ${doc.endpoints.length} endpoints`);
          info(`    servers: ${doc.servers.join(', ')}`);
          const schemes = Object.keys(doc.securitySchemes);
          if (schemes.length) info(`    security schemes: ${schemes.join(', ')}`);
        }
      } catch (e: any) {
        err(`  Failed to parse cached specs: ${e.message}`);
      }
    });
}