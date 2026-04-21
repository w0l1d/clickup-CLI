#!/usr/bin/env node
import { Command } from 'commander';
import { registerAuth } from './commands/auth';
import { registerSpec } from './commands/spec';
import { registerList } from './commands/list';
import { registerCall } from './commands/call';
import { registerProbe } from './commands/probe';
import { registerReport } from './commands/report';

export function buildProgram(): Command {
  const program = new Command();
  program
    .name('clickup-cli')
    .description('CLI tool to explore and test ClickUp API endpoints')
    .version('0.1.0');

  registerAuth(program);
  registerSpec(program);
  registerList(program);
  registerCall(program);
  registerProbe(program);
  registerReport(program);

  return program;
}

if (require.main === module) {
  buildProgram().parseAsync(process.argv).catch((err) => {
    console.error(err?.message || err);
    process.exit(1);
  });
}
