import Table from 'cli-table3';
import chalk from 'chalk';
import { EndpointDef } from '../models/endpoint';

type ChalkFn = (text: string) => string;

const METHOD_COLORS: Record<string, ChalkFn> = {
  GET: (t: string) => chalk.green(t),
  POST: (t: string) => chalk.blue(t),
  PUT: (t: string) => chalk.yellow(t),
  PATCH: (t: string) => chalk.cyan(t),
  DELETE: (t: string) => chalk.red(t),
};

export function renderEndpointTable(endpoints: EndpointDef[]): void {
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
    const colorFn = METHOD_COLORS[ep.method] || ((t: string) => chalk.white(t));
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
