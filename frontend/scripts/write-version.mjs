import { readFile, writeFile } from 'node:fs/promises';

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const payload = JSON.stringify({ version: packageJson.version });

await writeFile(new URL('../public/version.json', import.meta.url), `${payload}\n`, 'utf8');
