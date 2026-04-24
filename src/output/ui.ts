import chalk from 'chalk';
import ora, { Ora } from 'ora';

let quiet = false;
let jsonMode = false;

export function setQuiet(on: boolean): void { quiet = on; }
export function setJsonMode(on: boolean): void { jsonMode = on; }
export function isQuiet(): boolean { return quiet; }
export function isJsonMode(): boolean { return jsonMode; }

const noColorEnv = !!process.env.NO_COLOR;
const ciEnv = !!process.env.CI;
const stdoutTTY = !!process.stdout.isTTY;
const stderrTTY = !!process.stderr.isTTY;

if (noColorEnv || !stdoutTTY) {
  chalk.level = 0;
}

function chromeSuppressed(): boolean {
  return quiet || jsonMode;
}

export function info(msg: string): void {
  if (chromeSuppressed()) return;
  process.stderr.write(msg + '\n');
}

export function note(msg: string): void {
  if (chromeSuppressed()) return;
  process.stderr.write(chalk.dim(msg) + '\n');
}

export function warn(msg: string): void {
  process.stderr.write((chalk.yellow ? chalk.yellow(msg) : msg) + '\n');
}

export function err(msg: string): void {
  process.stderr.write((chalk.red ? chalk.red(msg) : msg) + '\n');
}

export function stdout(msg: string): void {
  process.stdout.write(msg + '\n');
}

interface FakeSpinner {
  text: string;
  start(): FakeSpinner;
  stop(): FakeSpinner;
  succeed(text?: string): FakeSpinner;
  fail(text?: string): FakeSpinner;
}

function fakeSpinner(): FakeSpinner {
  const s: FakeSpinner = {
    text: '',
    start() { return s; },
    stop() { return s; },
    succeed() { return s; },
    fail() { return s; },
  };
  return s;
}

export function spinner(text: string): Ora | FakeSpinner {
  if (chromeSuppressed() || !stderrTTY || ciEnv) return fakeSpinner();
  return ora({ text, stream: process.stderr });
}

export function shouldSuppressChrome(): boolean { return chromeSuppressed(); }
