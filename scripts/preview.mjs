#!/usr/bin/env node
// Site preview: stages the page as Pages deploys it (scripts/stage-site.sh), serves it, and writes
// what a reviewer needs to judge a change:
//   <out>/page-1440.png, <out>/page-390.png   full pages, every loop showing its first frame
//   <out>/card-<width>-<n>-<name>.png         each loop's card in view, playing
// It checks that every loop's poster matches the loop's first frame (a poster that differs jumps
// when the loop starts), that every loop loads, and that the page has no console errors, failed
// requests or horizontal scroll. Exits 1 on any failure, listing them.
//
//   node scripts/preview.mjs [--out shots/preview] [--threshold 0.04] [--no-cards]
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, rm, mkdir, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : dflt; };
const out = resolve(opt('out', join(root, 'shots/preview')));
const threshold = Number(opt('threshold', '0.04'));
const cards = !args.includes('--no-cards');
const VIEWPORTS = [{ width: 1440, height: 900, mobile: false }, { width: 390, height: 844, mobile: true }];
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webm': 'video/webm', '.json': 'application/json' };

await rm(join(root, '_site'), { recursive: true, force: true });
execFileSync('bash', [join(root, 'scripts/stage-site.sh')], { stdio: 'inherit' });
const site = join(root, '_site');

// Serves _site with byte ranges, which video elements need to seek.
const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = join(site, path);
    if (!file.startsWith(site)) { res.writeHead(403).end(); return; }
    const size = (await stat(file)).size;
    const type = TYPES[extname(file)] ?? 'application/octet-stream';
    const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '');
    const body = await readFile(file);
    if (range) {
      const start = range[1] ? Number(range[1]) : 0;
      const end = range[2] ? Number(range[2]) : size - 1;
      res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
      res.end(body.subarray(start, end + 1));
    } else {
      res.writeHead(200, { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes' });
      res.end(body);
    }
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;
await mkdir(out, { recursive: true });

const fails = [];
const browser = await chromium.launch();
try {
  for (const vp of VIEWPORTS) {
    const tag = vp.width;
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.mobile, hasTouch: vp.mobile });
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') fails.push(`${tag}: console error: ${m.text()}`); });
    page.on('pageerror', (e) => fails.push(`${tag}: page error: ${e.message}`));
    page.on('requestfailed', (r) => { if (!/ERR_ABORTED/.test(r.failure()?.errorText ?? '')) fails.push(`${tag}: request failed: ${r.url()}`); });
    page.on('response', (r) => { if (r.status() >= 400) fails.push(`${tag}: ${r.status()} ${r.url()}`); });
    await page.goto(base, { waitUntil: 'networkidle' });

    const loops = await page.$$('video.loop');
    for (const [i, video] of loops.entries()) {
      await video.evaluate((v) => v.scrollIntoView({ block: 'center' }));
      const ready = await video.evaluate((v) => new Promise((done) => {
        const t0 = performance.now();
        (function wait() { if (v.readyState >= 2) done(true); else if (performance.now() - t0 > 8000) done(false); else setTimeout(wait, 100); })();
      }));
      const name = await video.evaluate((v) => (v.querySelector('source')?.dataset.src ?? v.currentSrc ?? '').split('/').pop().replace(/\.\w+$/, '') || 'loop');
      if (!ready) { fails.push(`${tag}: loop ${name} never loaded`); continue; }
      if (cards) {
        await page.waitForTimeout(600);
        const card = await video.evaluateHandle((v) => v.closest('.card, figure, header') ?? v);
        await card.asElement().screenshot({ path: join(out, `card-${tag}-${String(i + 1).padStart(2, '0')}-${name}.png`) });
      }
      // The poster against the loop's first frame, both drawn small and compared pixel by pixel.
      const diff = await video.evaluate(async (v) => {
        v.pause();
        await new Promise((done) => { if (v.currentTime === 0) done(); else { v.addEventListener('seeked', done, { once: true }); v.currentTime = 0; } });
        if (!v.poster) return null;
        const img = new Image();
        img.src = v.poster;
        await img.decode();
        const W = 160, H = 90;
        const read = (src) => { const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.drawImage(src, 0, 0, W, H); return g.getImageData(0, 0, W, H).data; };
        const a = read(v), b = read(img);
        let sum = 0;
        for (let k = 0; k < a.length; k += 4) sum += Math.abs(a[k] - b[k]) + Math.abs(a[k + 1] - b[k + 1]) + Math.abs(a[k + 2] - b[k + 2]);
        return sum / (W * H * 3 * 255);
      });
      if (diff === null) fails.push(`${tag}: loop ${name} has no poster`);
      else if (diff > threshold) fails.push(`${tag}: poster for ${name} differs from the loop's first frame (${(diff * 100).toFixed(1)}% > ${(threshold * 100).toFixed(1)}%)`);
      else if (tag === VIEWPORTS[0].width) console.log(`poster ${name}: ${(diff * 100).toFixed(1)}% from frame 0`);
    }

    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) fails.push(`${tag}: the page scrolls sideways`);
    // Every loop now sits paused on its first frame, so the full page shows no blank players.
    // Bringing a loop into view scrolls its gallery sideways too; put every gallery back at its start.
    await page.evaluate(() => { for (const g of document.querySelectorAll('.strip')) g.scrollLeft = 0; scrollTo(0, 0); });
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(out, `page-${tag}.png`), fullPage: true });
    await ctx.close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log(`preview: wrote ${out}`);
if (fails.length) {
  console.error(`preview: ${fails.length} problem${fails.length === 1 ? '' : 's'}`);
  for (const f of fails) console.error(`  ${f}`);
  process.exit(1);
}
console.log('preview: ok');
