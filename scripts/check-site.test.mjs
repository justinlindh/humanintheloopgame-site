import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { checkSite } from './check-site.mjs';

function fixture(t, html, files = {}, notFound = '') {
  const root = mkdtempSync(join(tmpdir(), 'site-check-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [name, content] of Object.entries({
    'index.html': html, '404.html': notFound, 'play/index.html': '', ...files,
  })) {
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(join(root, name), content);
  }
  return checkSite(root);
}

test('rejects an omitted script even when other page assets are deployed', t => {
  assert.deepEqual(fixture(t, '<script src="gallery.js"></script>').errors,
    ['index.html: missing gallery.js in _site']);
  assert.deepEqual(fixture(t, '<script src="gallery.js"></script>', { 'gallery.js': '' }).errors, []);
});

test('checks src, href, poster and every srcset candidate on both pages', t => {
  const markup = `<a href='/missing-link?x=1&amp;y=2#part'>link</a>
    <video poster=missing-poster><source src="missing-video"></video>
    <img srcset="present.png 1x, missing-wide.png 2x">`;
  const result = fixture(t, markup, { 'present.png': '' }, markup);
  for (const page of ['index.html', '404.html']) {
    for (const ref of ['/missing-link?x=1&y=2#part', 'missing-poster', 'missing-video', 'missing-wide.png']) {
      assert.ok(result.errors.includes(`${page}: missing ${ref} in _site`), ref);
    }
  }
  assert.equal(result.errors.length, 8);
});

test('resolves encoded paths, root links, fragments and nested CSS URLs', t => {
  const result = fixture(t, `<a href="/">home</a><a href="#part">part</a>
    <img src="img/a%20b.png?size=2#x"><link href="css/site.css">
    <a href="https://other.test/missing">external</a><img src="//other.test/img">
    <a href="mailto:test@example.test">email</a><img src="data:image/png;base64,AAAA">
    <img srcset="data:image/png;base64,AAAA 1x, img/a%20b.png 2x">`, {
    'img/a b.png': '', 'css/site.css': 'body { background: url("../img/a%20b.png"); }',
  });
  assert.deepEqual(result.errors, []);
});

test('checks inline and external fetches, imports and script-assigned media', t => {
  const result = fixture(t, `<script>fetch('inline.json'); const v = {}; v.src = 'trailer.mp4';</script>
    <script src="js/app.js"></script>`, {
    'js/app.js': `import './child.js'; const path = 'external.json'; window.fetch(path);`,
    'js/child.js': `fetch('child.json');`,
  });
  assert.deepEqual(new Set(result.errors), new Set([
    'index.html: missing inline.json in _site', 'index.html: missing trailer.mp4 in _site',
    'js/app.js: missing external.json in _site', 'js/child.js: missing child.json in _site',
  ]));
});

test('checks lazy and wide media even behind runtime conditions', t => {
  const result = fixture(t, `<video data-poster-wide="wide.webp"></video>
    <source data-src="small.mp4" data-src-wide="wide.mp4">
    <script>source.src = (wide && source.dataset.srcWide) || source.dataset.src;
    video.poster = video.dataset.posterWide;</script>`, { 'small.mp4': '' });
  assert.deepEqual(result.errors, [
    'index.html: missing wide.webp in _site', 'index.html: missing wide.mp4 in _site',
  ]);
});

test('fails closed on fetch URLs that cannot be resolved', t => {
  assert.deepEqual(fixture(t, '<script>fetch(getPath());</script>').errors,
    ['index.html: cannot resolve fetch URL statically']);
});

test('does not treat directories as files or allow encoded traversal', t => {
  const result = fixture(t, '<img src="play"><img src="/%2e%2e%2foutside">');
  assert.deepEqual(result.errors, [
    'index.html: missing play in _site', 'index.html: URL escapes _site: /%2e%2e%2foutside',
  ]);
});

test('requires each deployed page and rejects base URLs that change resolution', t => {
  assert.deepEqual(fixture(t, '<base href="/other/">').errors, [
    'index.html: base href is unsupported; keep site URLs relative to the page',
    'index.html: missing /other/ in _site',
  ]);
});

test('does not guess which shadowed URL constant a fetch uses', t => {
  const result = fixture(t, `<script>
    const path = 'exists.json';
    function load() { const path = getPath(); fetch(path); }
  </script>`, { 'exists.json': '' });
  assert.deepEqual(result.errors, ['index.html: cannot resolve fetch URL statically']);
});

test('rejects parameter, mutable and destructured bindings that shadow constants', t => {
  for (const code of [
    `function load(endpoint) { fetch(endpoint); } load('missing.json');`,
    `{ let endpoint = 'missing.json'; fetch(endpoint); }`,
    `function load({ endpoint }) { fetch(endpoint); }`,
    `function load([endpoint]) { fetch(endpoint); }`,
    `function load(endpoint = 'missing.json') { fetch(endpoint); }`,
    `try {} catch (endpoint) { fetch(endpoint); }`,
  ]) {
    const result = fixture(t, `<script>const endpoint = 'exists.json'; ${code}</script>`, { 'exists.json': '' });
    assert.deepEqual(result.errors, ['index.html: cannot resolve fetch URL statically'], code);
  }
});
