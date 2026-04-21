import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { setApiKey, getApiKey, getConfigPath, getBaseUrlV2 } from '../core/config';
import { createClient } from '../core/apiClient';

export function registerAuth(program: Command): void {
  const auth = program.command('auth').description('Manage ClickUp API authentication');

  auth
    .command('set <token>')
    .description('Store your ClickUp API key')
    .action((token: string) => {
      setApiKey(token);
      console.log(chalk.green('✓ API key saved'));
      console.log(chalk.dim(`  Config: ${getConfigPath()}`));
    });

  auth
    .command('check')
    .description('Validate stored API key and show user info')
    .action(async () => {
      const key = getApiKey();
      if (!key) {
        console.error(chalk.red('No API key set. Run: clickup-cli auth set <token>'));
        process.exit(1);
      }

      const spinner = ora('Validating API key...').start();
      try {
        const client = createClient(getBaseUrlV2());
        const res = await client.get('/user');
        spinner.succeed('API key is valid');
        const user = res.data?.user;
        console.log(`  ${chalk.bold('Name:')}  ${user?.username || user?.email}`);
        console.log(`  ${chalk.bold('Email:')} ${user?.email}`);
        console.log(`  ${chalk.bold('ID:')}    ${user?.id}`);
      } catch (err: any) {
        spinner.fail('API key validation failed');
        console.error(chalk.red(`  ${err.response?.data?.err || err.message}`));
        process.exit(1);
      }
    });

  auth
    .command('whoami')
    .description('Show stored API key info')
    .action(() => {
      const key = getApiKey();
      if (!key) {
        console.log(chalk.yellow('No API key configured.'));
        console.log('Run: clickup-cli auth set <token>');
      } else {
        const masked = key.slice(0, 6) + '****' + key.slice(-4);
        console.log(`  ${chalk.bold('API Key:')} ${masked}`);
        console.log(`  ${chalk.bold('Config:')}  ${getConfigPath()}`);
      }
    });
}
