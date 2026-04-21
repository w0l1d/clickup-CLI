import chalk from 'chalk';

export function printJson(data: unknown): void {
  const json = JSON.stringify(data, null, 2);
  // Simple syntax highlighting
  const highlighted = json
    .replace(/"([^"]+)":/g, (_, k) => `${chalk.cyan(`"${k}")}:`)
    .replace(/: "([^"]*)"/g, (_, v) => `: ${chalk.green(`"${v}"`)}`)
    .replace(/: (true|false)/g, (_, v) => `: ${chalk.yellow(v)}`)
    .replace(/: (\d+)/g, (_, v) => `: ${chalk.magenta(v)}`);
  console.log(highlighted);
}
