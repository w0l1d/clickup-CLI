import chalk from 'chalk';

export function printJson(data: unknown): void {
  const json = JSON.stringify(data, null, 2);
  const highlighted = json
    .replace(/"([^"\\]*)":/g, (_, k) => `${chalk.cyan(`"${k}"`)}:`)
    .replace(/: "([^"\\]*)"/g, (_, v) => `: ${chalk.green(`"${v}"`)}`)
    .replace(/: (true|false|null)/g, (_, v) => `: ${chalk.yellow(v)}`)
    .replace(/: (-?\d+(?:\.\d+)?)/g, (_, v) => `: ${chalk.magenta(v)}`);
  console.log(highlighted);
}
