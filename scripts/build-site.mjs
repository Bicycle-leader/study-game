import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lecturePages } from '../public/lecture-content.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const publicDirectory = path.join(root, 'public');
const lectureImageDirectory = path.join(publicDirectory, 'assets', 'lecture');
const serverDirectory = path.join(root, 'dist', 'server');
const lectureImport = "import { lecturePages } from './public/lecture-content.mjs';";
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
};

async function bundleAssets(directory) {
  const assets = {};
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      // Hosted lecture PNGs are streamed from R2 instead of bundled into JavaScript.
      if (filename === lectureImageDirectory) continue;
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
const [assets, engine] = await Promise.all([
  bundleAssets(publicDirectory),
  readFile(path.join(root, 'quiz-engine.mjs'), 'utf8'),
]);
if (!engine.includes(lectureImport) || !lecturePages.length) {
  throw new Error('Cannot bundle the lecture topic index.');
}
// Keep the full slides in browser assets. The quiz only uses their positions and topic labels.
const lectureIndex = lecturePages.map(({ label, chapter, title, image }) => image ? { image: true } : { label, chapter, title });
const builtEngine = engine.replace(lectureImport, () => `const lecturePages = ${JSON.stringify(lectureIndex)};`);
await Promise.all([
  copyFile(path.join(root, 'worker', 'site.mjs'), path.join(serverDirectory, 'index.js')),
  writeFile(path.join(serverDirectory, 'quiz-engine.mjs'), builtEngine),
  writeFile(path.join(serverDirectory, 'assets.mjs'), `export default ${JSON.stringify(assets)};\n`),
  rm(path.join(serverDirectory, 'public', 'lecture-content.mjs'), { force: true }),
]);
