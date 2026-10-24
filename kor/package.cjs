const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..'), out = path.join(root, 'dist');
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out);
for (const name of ['index.html', 'css', 'js', 'assets', 'sw.js', 'manifest.webmanifest', 'favicon.ico', 'version.json', 'LICENSE', 'LICENSE-NONCOMMERCIAL.md', 'CREDITS.md']) {
  fs.cpSync(path.join(root, name), path.join(out, name), { recursive: true });
}
fs.mkdirSync(path.join(out, 'kor'));
for (const name of ['bootstrap.js', 'style.css']) fs.copyFileSync(path.join(root, 'kor', name), path.join(out, 'kor', name));
// No raw dev page or upstream SEO pages, custom domain, Firebase credentials or deployment secrets.
if (fs.readFileSync(path.join(out, 'index.html'), 'utf8').includes('rel="canonical"')) throw new Error('Unexpected upstream canonical URL');
console.log('Release package created in dist/');
