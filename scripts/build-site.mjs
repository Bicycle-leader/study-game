import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const publicDirectory = path.join(root, 'public');
const serverDirectory = path.join(root, 'dist', 'server');
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
};

async function bundleAssets(directory) {
  const assets = {};
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      Object.assign(assets, await bundleAssets(filename));
      continue;
    }
    const contentType = mimeTypes[path.extname(entry.name)];
    if (!entry.isFile() || !contentType) throw new Error(`Unsupported site asset ${filename}`);
    const route = `/${path.relative(publicDirectory, filename).split(path.sep).join('/')}`;
    let content = await readFile(filename);
    if (route === '/index.html') {
      content = Buffer.from(content.toString('utf8').replace('<html lang="ko">', '<html lang="ko" data-hosted>'));
    }
    assets[route] = { contentType, base64: content.toString('base64') };
  }
  return assets;
}

await mkdir(serverDirectory, { recursive: true });
const assets = await bundleAssets(publicDirectory);
await Promise.all([
  copyFile(path.join(root, 'worker', 'site.mjs'), path.join(serverDirectory, 'index.js')),
  copyFile(path.join(root, 'quiz-engine.mjs'), path.join(serverDirectory, 'quiz-engine.mjs')),
  writeFile(path.join(serverDirectory, 'assets.mjs'), `export default ${JSON.stringify(assets)};\n`),
]);
