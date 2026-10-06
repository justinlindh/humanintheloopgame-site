import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'changelog');
const days = JSON.parse(readFileSync(resolve(root, 'entries.json'), 'utf8'));

test('days are unique, dated and non-empty', () => {
  const dates = days.map((d) => d.date);
  assert.equal(new Set(dates).size, dates.length, 'one entry per day');
  for (const d of days) {
    assert.match(d.date, /^\d{4}-\d\d-\d\d$/);
    assert.ok(d.headline, `${d.date} has a headline`);
    assert.ok(d.items.length > 0, `${d.date} has items`);
  }
});

test('every item has an area, title and body', () => {
  for (const d of days) {
    for (const i of d.items) {
      for (const k of ['area', 'title', 'body']) assert.ok(typeof i[k] === 'string' && i[k].trim(), `${d.date} item missing ${k}`);
    }
  }
});

test('media is a still that exists, or a feature-media link', () => {
  for (const d of days) {
    for (const i of d.items) {
      for (const m of i.media ?? []) {
        assert.equal(m.kind, 'image', `${d.date} ${m.src}: stills only`);
        if (m.src.startsWith('https://')) {
          assert.match(m.src, /^https:\/\/raw\.githubusercontent\.com\/justinlindh\/human-in-the-loop\/feature-media\/[\w.-]+\.(webp|png)$/, `${d.date} ${m.src}`);
        } else {
          assert.ok(existsSync(resolve(root, m.src)), `${d.date} missing file ${m.src}`);
        }
      }
    }
  }
});

test('every file under changelog/media is used by an entry', () => {
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(resolve(dir, e.name)) : [resolve(dir, e.name)]));
  const used = new Set(days.flatMap((d) => d.items.flatMap((i) => (i.media ?? []).map((m) => resolve(root, m.src)))));
  const unused = walk(resolve(root, 'media')).filter((f) => !used.has(f));
  assert.deepEqual(unused, [], 'files that ship but no entry shows');
});

test('the text follows the house style', () => {
  const text = readFileSync(resolve(root, 'entries.json'), 'utf8');
  assert.ok(!text.includes(String.fromCharCode(8212)), 'no em dashes');
  assert.ok(!/startup/i.test(text), 'say company or lab');
});
