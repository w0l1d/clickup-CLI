import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import {
  clearApiToken,
  getApiToken,
  getConfigPath,
  getTokenKind,
  setApiToken,
  setTokenKind,
  TokenKind,
} from '../store/config';
import { createClient, requestWithRetry } from '../http/client';
import { fetchSpecs } from '../spec/loader';
import { parseSpecs } from '../spec/parser';

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

export function registerAuth(program: Command): void {
  const auth = program.command('auth').description('Manage ClickUp API authentication');

  auth
    .command('set <token>')
    .description('Store your ClickUp API token')
    .option('--kind <kind>', 'Token kind: personal, bearer, or auto', 'auto')
    .action((token: string, opts: { kind?: string }) => {
      const kind = opts.kind || 'auto';
      if (!isValidKind(kind)) {
        console.error(chalk.red(`Invalid --kind: ${kind}. Use personal, bearer, or auto.`));
        process.exit(1);
      }
      setApiToken(token);
      setTokenKind(kind);
      console.log(chalk.green('✓ Token saved'));
      console.log(chalk.dim(`  Kind:   ${kind}`));
      console.log(chalk.dim(`  Config: ${getConfigPath()}`));
    });

  auth
    .command('check')
    .description('Validate stored token against /user')
    .action(async () => {
      const token = getApiToken();
      if (!token) {
        console.error(chalk.red('No token set. Run: clickup-cli auth set <token>'));
        process.exit(1);
      }
      const spinner = ora('Validating token...').start();
      try {
        const info = await v2EndpointInfo();
        const client = createClient(info.server);
        const res = await requestWithRetry(client, {
          method: 'GET', url: info.userPath, validateStatus: () => true,
        }, { retries: 1 });
        if (res.status >= 200 && res.status < 300) {
          spinner.succeed('Token is valid');
          const user = (res.data as any)?.user;
          console.log(`  ${chalk.bold('Name:')}  ${user?.username || user?.email}`);
          console.log(`  ${chalk.bold('Email:')} ${user?.email}`);
          console.log(`  ${chalk.bold('ID:')}    ${user?.id}`);
        } else {
          spinner.fail(`Token invalid (HTTP ${res.status})`);
          const msg = (res.data as any)?.err || (res.data as any)?.ECODE;
          if (msg) console.error(chalk.red(`  ${msg}`));
          process.exit(1);
        }
      } catch (err: any) {
        spinner.fail('Token validation failed');
        console.error(chalk.red(`  ${err.message}`));
        process.exit(1);
      }
    });

  auth
    .command('whoami')
    .description('Show stored token info')
    .action(() => {
      const token = getApiToken();
      if (!token) {
        console.log(chalk.yellow('No token configured.'));
        console.log('Run: clickup-cli auth set <token>');
        return;
      }
      const masked = token.length > 10
        ? token.slice(0, 6) + '****' + token.slice(-4)
        : '****';
      console.log(`  ${chalk.bold('Token:')}  ${masked}`);
      console.log(`  ${chalk.bold('Kind:')}   ${getTokenKind()}`);
      console.log(`  ${chalk.bold('Config:')} ${getConfigPath()}`);
    });

  auth
    .command('clear')
    .description('Remove stored token')
    .action(() => {
      clearApiToken();
      console.log(chalk.green('✓ Token cleared'));
    });
}
