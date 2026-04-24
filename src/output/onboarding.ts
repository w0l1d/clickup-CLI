import chalk from 'chalk';
import { isJsonMode } from './ui';

export const TOKEN_HELP_URL = 'https://app.clickup.com/settings/apps';
export const TOKEN_DOCS_URL = 'https://clickup.com/api/developer-portal/authentication/#personal-token';

export function printTokenMissingHelp(): void {
  if (isJsonMode()) {
    process.stderr.write(
      JSON.stringify({
        error: 'no_token',
        message: 'No ClickUp API token configured.',
        help_url: TOKEN_HELP_URL,
        docs_url: TOKEN_DOCS_URL,
        env_vars: ['CLICKUP_TOKEN', 'CLICKUP_API_TOKEN', 'CLICKUP_API_KEY'],
        fix: [
          "Set env var: export CLICKUP_TOKEN='pk_xxx'",
          'Or run: clickup auth login',
          'Or run: clickup auth set <token>',
        ],
      }) + '\n'
    );
    return;
  }

  const w = (s: string): void => { process.stderr.write(s + '\n'); };
  w('');
  w(chalk.red('  No ClickUp API token configured.'));
  w('');
  w(chalk.bold('  Get a personal token (takes ~20 seconds):'));
  w(`    1. Open ${chalk.cyan(TOKEN_HELP_URL)}`);
  w('    2. Click "Generate" under "API Token"');
  w('    3. Copy the token (starts with "pk_")');
  w('');
  w(chalk.bold('  Then pick one:'));
  w(`    ${chalk.green('clickup auth login')}           ${chalk.dim('# guided: opens browser + prompts for token')}`);
  w(`    ${chalk.green('clickup auth set pk_xxx')}      ${chalk.dim('# paste directly')}`);
  w(`    ${chalk.green("export CLICKUP_TOKEN='pk_xxx'")} ${chalk.dim('# env var (CI / agents)')}`);
  w('');
}
