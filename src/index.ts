#!/usr/bin/env node
import { Command } from 'commander';
import { registerAuth } from './commands/auth';
import { registerSpec } from './commands/spec';
import { registerList } from './commands/list';
import { registerProbe } from './commands/probe';
import { registerCall } from './commands/call';
import { registerReport } from './commands/report';

const program = new Command();

program
  .name('clickup-cli')
  .description('CLI tool to explore and test ClickUp API endpoints')
  .version('0.1.0');

registerAuth(program);
registerSpec(program);
registerList(program);
registerProbe(program);
registerCall(program);
registerReport(program);

program.parse(process.argv);
