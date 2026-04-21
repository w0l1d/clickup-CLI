import Table from 'cli-table3';
import chalk from 'chalk';
import { Endpoint } from '../spec/model';

const METHOD_COLORS: Record<string, (t: string) => string> = {
  GET: chalk.green,
  POST: chalk.blue,
  PUT: chalk.yellow,
  PATCH: chalk.cyan,
  DELETE: chalk.red,
};

export function renderEndpointTable(endpoints: Endpoint[]): void {
  const table = new Table({
    head: [
      chalk.bold('Ver'),
      chalk.bold('Method'),
      chalk.bold('Path'),
      chalk.bold('Tags'),
      chalk.bold('Summary'),
    ],
    colWidths: [5, 9, 55, 20, 40],
    wordWrap: true,
    style: { head: [], border: [] },
  });

  for (const ep of endpoints) {
    const colorFn = METHOD_COLORS[ep.method] || chalk.white;
    table.push([
      ep.apiVersion,
      colorFn(ep.method),
      ep.path,
      ep.tags.join(', '),
      ep.summary.slice(0, 60),
    ]);
  }

  console.log(table.toString());
  console.log(chalk.dim(`  ${endpoints.length} endpoint(s) shown`));
}
