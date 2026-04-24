import { Command } from 'commander';
import chalk from 'chalk';
import { fetchSpecs } from '../spec/loader';
import { allEndpoints, parseSpecs } from '../spec/parser';
import { Endpoint } from '../spec/model';
import { spinner, setJsonMode, isJsonMode, err, stdout, note } from '../output/ui';

function findOne(endpoints: Endpoint[], query: string): Endpoint | null {
  const exact = endpoints.find((e) => e.operationId === query);
  if (exact) return exact;
  const q = query.toLowerCase();
  const matches = endpoints.filter(
    (e) => e.operationId.toLowerCase().includes(q) || e.path.toLowerCase().includes(q)
  );
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    process.stderr.write(chalk.yellow(`Multiple matches for "${query}":\n\n`));
    for (const m of matches) {
      process.stderr.write(`  ${chalk.green(m.method.padEnd(7))} ${m.operationId}  ${chalk.dim(m.path)}\n`);
    }
    process.stderr.write('\nUse the exact operationId.\n');
    return null;
  }
  return null;
}

export function registerDescribe(program: Command): void {
  program
    .command('describe <endpoint>')
    .description('Show full schema for an endpoint (params, body, responses) without calling it')
    .option('--format <format>', 'Output format: pretty or json', 'pretty')
    .action(async (endpointQuery: string, opts: { format?: string }) => {
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

      const ep = findOne(endpoints, endpointQuery);
      if (!ep) {
        if (!endpoints.some((e) => e.operationId.toLowerCase().includes(endpointQuery.toLowerCase()))) {
          err(`Endpoint not found: ${endpointQuery}`);
          note('Use: clickup list --search <query>');
        }
        process.exit(1);
      }

      if (isJsonMode()) {
        stdout(JSON.stringify({
          operationId: ep.operationId,
          method: ep.method,
          path: ep.path,
          apiVersion: ep.apiVersion,
          serverUrl: ep.serverUrl,
          summary: ep.summary,
          description: ep.description,
          tags: ep.tags,
          parameters: ep.parameters,
          requestBody: ep.requestBody ?? null,
          responses: ep.responses,
        }, null, 2));
        return;
      }

      // Pretty output
      process.stdout.write(`\n`);
      process.stdout.write(`  ${chalk.bold('Operation:')}  ${ep.operationId}\n`);
      process.stdout.write(`  ${chalk.bold('Method:')}     ${chalk.green(ep.method)}\n`);
      process.stdout.write(`  ${chalk.bold('Path:')}       ${ep.path}\n`);
      process.stdout.write(`  ${chalk.bold('API:')}        ${ep.apiVersion}\n`);
      process.stdout.write(`  ${chalk.bold('Server:')}     ${ep.serverUrl}\n`);
      if (ep.tags.length) process.stdout.write(`  ${chalk.bold('Tags:')}       ${ep.tags.join(', ')}\n`);
      if (ep.summary) process.stdout.write(`  ${chalk.bold('Summary:')}    ${ep.summary}\n`);
      if (ep.description) process.stdout.write(`  ${chalk.bold('Description:')} ${ep.description.slice(0, 200)}${ep.description.length > 200 ? '…' : ''}\n`);

      if (ep.parameters.length) {
        process.stdout.write(`\n  ${chalk.bold('Parameters:')}\n`);
        const required = ep.parameters.filter((p) => p.required);
        const optional = ep.parameters.filter((p) => !p.required);
        for (const p of required) {
          const type = p.schema?.type ?? 'unknown';
          const example = p.example ?? p.schema?.example ?? p.schema?.default;
          process.stdout.write(
            `    ${chalk.red('*')} ${chalk.bold(p.name)} ${chalk.dim(`(${p.in}, ${type})`)}` +
            (example !== undefined ? chalk.dim(`  e.g. ${JSON.stringify(example)}`) : '') +
            (p.description ? `\n       ${chalk.dim(p.description.slice(0, 100))}` : '') + '\n'
          );
        }
        for (const p of optional) {
          const type = p.schema?.type ?? 'unknown';
          const example = p.example ?? p.schema?.example ?? p.schema?.default;
          process.stdout.write(
            `      ${chalk.bold(p.name)} ${chalk.dim(`(${p.in}, ${type})`)}` +
            (example !== undefined ? chalk.dim(`  e.g. ${JSON.stringify(example)}`) : '') +
            (p.description ? `\n       ${chalk.dim(p.description.slice(0, 100))}` : '') + '\n'
          );
        }
        if (required.length) process.stdout.write(`  ${chalk.dim('* = required')}\n`);
      }

      if (ep.requestBody) {
        const rb = ep.requestBody;
        process.stdout.write(`\n  ${chalk.bold('Request Body:')} ${rb.contentType}${rb.required ? chalk.red(' (required)') : chalk.dim(' (optional)')}\n`);
        if (rb.schema?.properties) {
          const props = rb.schema.properties;
          const reqFields: string[] = Array.isArray(rb.schema.required) ? rb.schema.required as string[] : [];
          for (const [key, schema] of Object.entries(props)) {
            const isReq = reqFields.includes(key);
            process.stdout.write(
              `    ${isReq ? chalk.red('*') : ' '} ${chalk.bold(key)} ${chalk.dim(`(${(schema as any).type ?? 'any'})`)}\n`
            );
          }
          if (reqFields.length) process.stdout.write(`  ${chalk.dim('* = required')}\n`);
        }
        if (rb.example !== undefined) {
          process.stdout.write(`\n  ${chalk.bold('Body example:')}\n`);
          process.stdout.write('    ' + JSON.stringify(rb.example, null, 2).replace(/\n/g, '\n    ') + '\n');
        }
      }

      if (Object.keys(ep.responses).length) {
        process.stdout.write(`\n  ${chalk.bold('Responses:')}\n`);
        for (const [code, resp] of Object.entries(ep.responses)) {
          process.stdout.write(`    ${chalk.cyan(code)}  ${resp.description ?? ''}\n`);
        }
      }

      process.stdout.write('\n');
    });
}
