#!/usr/bin/env node
import { buildProgram } from './cli';

buildProgram().parseAsync(process.argv).catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
