import { pathToFileURL } from 'node:url';
import { loadConfig } from './config.ts';
import { run } from './run.ts';

export const main = async (): Promise<void> => {
  const config = loadConfig(process.env);
  const report = await run(config);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
