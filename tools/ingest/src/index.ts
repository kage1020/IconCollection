import { pathToFileURL } from 'node:url';

export const main = (): void => {
  console.log('ingest: not implemented');
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
