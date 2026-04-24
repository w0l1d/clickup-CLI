import { Command } from 'commander';
import chalk from 'chalk';
import * as readline from 'readline';
import { spawn } from 'child_process';
import {
  clearApiToken,
  getApiToken,
  getConfigPath,
  getTokenKind,
  getTokenSource,
  setApiToken,
  setTokenKind,
  TokenKind,
} from '../store/config';
import { createClient, requestWithRetry } from '../http/client';
import { fetchSpecs } from '../spec/loader';
import { parseSpecs } from '../spec/parser';
import { spinner, isJsonMode, stdout, err, info } from '../output/ui';
import { printTokenMissingHelp, TOKEN_HELP_URL } from '../output/onboarding';

function isValidKind(s: string): s is TokenKind {
  return s === 'personal' || s === 'bearer' || s === 'auto';
}

async function v2EndpointInfo(): Promise<{ server: string; userPath: string }> {
  try {
    const specs = await fetchSpecs();
    const docs = await parseSpecs(specs.v2, specs.v3);
    const v2 = docs.find((d) => d.version === 'v2');
    if (v2?.servers[0]) {
      const userEp = v2.endpoints.find((e) => e.operationId === 'GetAuthorizedUser' || /\/user$/.test(e.path));
      return { server: v2.servers[0], userPath: userEp?.path || '/v2/user' };
    }
  } catch {
    /* fall back */
  }
  return { server: 'https://api.clickup.com/api/v2', userPath: '/user' };
}

function openBrowser(url: string): void {
  const cmd =
    process.platform === 'darwin' ? 'open' :
    process.platform === 'win32' ? 'cmd' :
    'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '""', url] : [url];
  try {
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
    child.unref();
  } catch {
    /* silent — user still sees the URL printed */
  }
}

function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
    const stdin = process.stdin as NodeJS.ReadStream & { isRaw?: boolean };
    process.stderr.write(question);
    let answer = '';
    const onData = (ch: Buffer): void => {
      const s = ch.toString('utf8');
      if (s === '\n' || s === '\r' || s === '\r\n' || s === '') {
        stdin.removeListener('data', onData);
        if (stdin.isTTY) stdin.setRawMode(false);
        stdin.pause();
        process.stderr.write('\n');
        rl.close();
        resolve(answer);
        return;
      }
      if (s === '') { process.exit(130); }
      if (s === '' || s === '\b') { answer = answer.slice(0, -1); return; }
      answer += s;
    };
    if (stdin.isTTY) stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onData);
  });
}

export function registerAuth(program: Command): void {
  const auth = program.command('auth').description('Manage ClickUp API authentication');

  auth
    .command('login')
    .description('Guided token setup: opens browser and prompts for token')
    .option('--no-open', 'Do not try to open the browser')
    .action(async (opts: { open?: boolean }) => {
      info('');
      info(chalk.bold('  ClickUp token setup'));
      info('');
      info(`  Generate a token at: ${chalk.cyan(TOKEN_HELP_URL)}`);
      info('  (Settings → Apps → "Generate" under API Token)');
      info('');
      if (opts.open !== false) {
        info(chalk.dim('  Opening browser...'));
        openBrowser(TOKEN_HELP_URL);
      }
      if (!process.stdin.isTTY) {
        err('  Non-interactive shell: paste your token with:');
        err("    export CLICKUP_TOKEN='pk_xxx'");
        err('    or: clickup auth set <token>');
        process.exit(1);
      }
      const token = (await promptHidden('  Paste token (input hidden): ')).trim();
      if (!token) {
        err('  No token entered.');
        process.exit(1);
      }
      setApiToken(token);
      setTokenKind('auto');
      info(chalk.green('  ✓ Token saved'));
      info(chalk.dim(`    Config: ${getConfigPath()}`));
      info('');
      info('  Validating...');
      const res = await validateToken();
      if (!res.ok) {
        err(`  Token rejected (HTTP ${res.httpStatus ?? '—'}): ${res.message || 'invalid token'}`);
        process.exit(3);
      }
      info(chalk.green(`  ✓ Authenticated as ${res.username || res.email || res.id}`));
    });

  auth
    .command('set <token>')
    .description('Store your ClickUp API token')
    .option('--kind <kind>', 'Token kind: personal, bearer, or auto', 'auto')
    .action((token: string, opts: { kind?: string }) => {
      const kind = opts.kind || 'auto';
      if (!isValidKind(kind)) {
        err(`Invalid --kind: ${kind}. Use personal, bearer, or auto.`);
        process.exit(1);
      }
      setApiToken(token);
      setTokenKind(kind);
      info(chalk.green('✓ Token saved'));
      info(chalk.dim(`  Kind:   ${kind}`));
      info(chalk.dim(`  Config: ${getConfigPath()}`));
    });

  auth
    .command('check')
    .description('Validate stored token against /user')
    .action(async () => {
      if (!getApiToken()) {
        printTokenMissingHelp();
        process.exit(1);
      }
      const sp = spinner('Validating token...').start();
      const res = await validateToken();
      if (res.ok) {
        sp.succeed('Token is valid');
        if (isJsonMode()) {
          stdout(JSON.stringify({
            ok: true, source: getTokenSource(),
            user: { id: res.id, username: res.username, email: res.email },
          }));
        } else {
          info(`  ${chalk.bold('Name:')}  ${res.username || res.email}`);
          info(`  ${chalk.bold('Email:')} ${res.email}`);
          info(`  ${chalk.bold('ID:')}    ${res.id}`);
          info(`  ${chalk.bold('Source:')} ${getTokenSource()}`);
        }
        return;
      }
      sp.fail(`Token invalid (HTTP ${res.httpStatus ?? '—'})`);
      if (res.message) err(`  ${res.message}`);
      process.exit(3);
    });

  auth
    .command('whoami')
    .description('Show stored token info')
    .action(() => {
      const token = getApiToken();
      const source = getTokenSource();
      if (!token) {
        printTokenMissingHelp();
        return;
      }
      const masked = token.length > 10
        ? token.slice(0, 6) + '****' + token.slice(-4)
        : '****';
      if (isJsonMode()) {
        stdout(JSON.stringify({
          token_masked: masked, kind: getTokenKind(), source, config_path: getConfigPath(),
        }));
        return;
      }
      info(`  ${chalk.bold('Token:')}  ${masked}`);
      info(`  ${chalk.bold('Kind:')}   ${getTokenKind()}`);
      info(`  ${chalk.bold('Source:')} ${source}`);
      info(`  ${chalk.bold('Config:')} ${getConfigPath()}`);
    });

  auth
    .command('clear')
    .description('Remove stored token (does not affect env vars)')
    .action(() => {
      clearApiToken();
      info(chalk.green('✓ Token cleared from config'));
      if (getTokenSource() === 'env') {
        info(chalk.yellow('  Note: CLICKUP_TOKEN env var is still set in this shell.'));
      }
    });
}

async function validateToken(): Promise<{ ok: boolean; httpStatus?: number; message?: string; id?: string; username?: string; email?: string }> {
  try {
    const epInfo = await v2EndpointInfo();
    const client = createClient(epInfo.server);
    const res = await requestWithRetry(client, {
      method: 'GET', url: epInfo.userPath, validateStatus: () => true,
    }, { retries: 1 });
    if (res.status >= 200 && res.status < 300) {
      const user = (res.data as any)?.user || {};
      return { ok: true, httpStatus: res.status, id: user.id, username: user.username, email: user.email };
    }
    const msg = (res.data as any)?.err || (res.data as any)?.ECODE || `HTTP ${res.status}`;
    return { ok: false, httpStatus: res.status, message: String(msg) };
  } catch (e: any) {
    return { ok: false, message: e?.message || String(e) };
  }
}
