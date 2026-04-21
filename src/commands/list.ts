import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { fetchSpecs } from '../core/specLoader';
import { parseSpecs } from '../core/specParser';
import { EndpointDef } from '../models/endpoint';
import { renderEndpointTable } from '../output/table';

export function registerList(program: Command): void {
  program
    .command('list')
    .description('List all ClickUp API endpoints')
    .option('--api <version>', 'Filter by API version (v2 or v3)')
    .option('--method <method>', 'Filter by HTTP method (GET, POST, etc.)')
    .option('--tag <tag>', 'Filter by tag (case-insensitive)')
    .option('--search <query>', 'Search in path and summary')
    .option('--format <format>', 'Output format: table or json', 'table')
    .action(async (opts: { api?: string; method?: string; tag?: string; search?: string; format?: string }) => {
      const spinner = ora('Loading spec...').start();
      let endpoints: EndpointDef[];
      try {
        const specs = await fetchSpecs();
        endpoints = await parseSpecs(specs.v2, specs.v3);
        spinner.stop();
      } catch (err: any) {
        spinner.fail('Failed to load spec');
        console.error(chalk.red(err.message));
        process.exit(1);
      }

      // Apply filters
      if (opts.api) endpoints = endpoints.filter(e => e.apiVersion === opts.api);
      if (opts.method) endpoints = endpoints.filter(e => e.method === opts.method!.toUpperCase());
      if (opts.tag) {
        const tag = opts.tag.toLowerCase();
        endpoints = endpoints.filter(e => e.tags.some(t => t.toLowerCase().includes(tag)));
      }
      if (opts.search) {
        const q = opts.search.toLowerCase();
        endpoints = endpoints.filter(e =>
          e.path.toLowerCase().includes(q) || e.summary.toLowerCase().includes(q) || e.operationId.toLowerCase().includes(q)
        );
      }

      if (endpoints.length === 0) {
        console.log(chalk.yellow('No endpoints match the given filters.'));
        return;
      }

      if (opts.format === 'json') {
        console.log(JSON.stringify(endpoints, null, 2));
      } else {
        renderEndpointTable(endpoints);
      }
    });
}
