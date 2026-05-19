#!/usr/bin/env node
import { Command } from 'commander';
import { setQuiet } from './output/ui';
import { registerAuth } from './commands/auth';
import { registerSpec } from './commands/spec';
import { registerList } from './commands/list';
import { registerCall } from './commands/call';
import { registerProbe } from './commands/probe';
import { registerReport } from './commands/report';
import { registerDescribe } from './commands/describe';

export function buildProgram(): Command {
  const program = new Command();
  program
    .name('clickup')
    .description('CLI tool to explore and test ClickUp API endpoints')
    .version(require('../package.json').version)
    .option('-q, --quiet', 'Suppress progress output (data only on stdout)');

  // Apply --quiet before any command runs
  program.hook('preAction', () => {
    const opts = program.opts();
    if (opts.quiet) setQuiet(true);
  });

  registerAuth(program);
  registerSpec(program);
  registerList(program);
  registerCall(program);
  registerProbe(program);
  registerReport(program);
  registerDescribe(program);

  return program;
}

if (require.main === module) {
  buildProgram().parseAsync(process.argv).catch((e) => {
    process.stderr.write((e?.message || String(e)) + '\n');
    process.exit(1);
  });
}