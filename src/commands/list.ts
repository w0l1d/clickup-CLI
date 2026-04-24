import { Command } from 'commander';
import chalk from 'chalk';
import { fetchSpecs } from '../spec/loader';
import { allEndpoints, parseSpecs } from '../spec/parser';
import { Endpoint } from '../spec/model';
import { renderEndpointTable } from '../output/table';
import { spinner, setJsonMode, err, stdout } from '../output/ui';

export function registerList(program: Command): void {
  program
    .command('list')
    .description('List all ClickUp API endpoints')
    .option('--api <version>', 'Filter by API version (v2 or v3)')
    .option('--method <method>', 'Filter by HTTP method (GET, POST, etc.)')
    .option('--tag <tag>', 'Filter by tag (case-insensitive)')
    .option('--search <query>', 'Search in path, summary, operationId')
    .option('--format <format>', 'Output format: table or json', 'table')
    .action(async (opts: { api?: string; method?: string; tag?: string; search?: string; format?: string }) => {
      if (opts.format === 'json') setJsonMode(true);

      const sp = spinner('Loading spec...').start();
      let endpoints: Endpoint[];
      try {
        const specs = await fetchSpecs();
        const docs = await parseSpecs(specs.v2, specs.v3);
        endpoints = allEndpoints(docs);
        sp.stop();
      } catch (e: any) {
        sp.fail('Failed to load spec');
        err(e.message);
        process.exit(1);
      }

      if (opts.api) endpoints = endpoints.filter((e) => e.apiVersion === opts.api);
      if (opts.method) endpoints = endpoints.filter((e) => e.method === opts.method!.toUpperCase());
      if (opts.tag) {
        const tag = opts.tag.toLowerCase();
        endpoints = endpoints.filter((e) => e.tags.some((t) => t.toLowerCase().includes(tag)));
      }
      if (opts.search) {
        const q = opts.search.toLowerCase();
        endpoints = endpoints.filter(
          (e) =>
            e.path.toLowerCase().includes(q) ||
            e.summary.toLowerCase().includes(q) ||
            e.operationId.toLowerCase().includes(q)
        );
      }

      if (endpoints.length === 0) {
        process.stderr.write(chalk.yellow('No endpoints match the given filters.\n'));
        return;
      }

      if (opts.format === 'json') {
        stdout(JSON.stringify(endpoints, null, 2));
      } else {
        renderEndpointTable(endpoints);
      }
    });
}