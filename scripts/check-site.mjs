import { readFileSync, statSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse as parseHTML } from 'parse5';
import { parse as parseJS } from 'acorn';
import { simple } from 'acorn-walk';
import parseSrcset from 'parse-srcset';

const origin = 'https://site.invalid';
const attrs = new Set(['src', 'href', 'poster']);

export function checkSite(root) {
  root = resolve(root);
  const errors = new Set();
  const visited = new Set();
  let checked = 0;
  const error = (source, message) => errors.add(`${source}: ${message}`);

  function reference(value, base, source) {
    if (!value.trim() || value.trim().startsWith('#')) return;
    let url;
    try { url = new URL(value, base); }
    catch { error(source, `invalid URL ${value}`); return; }
    if (url.origin !== origin) return;
    let file;
    try { file = resolve(root, `.${decodeURIComponent(url.pathname)}`); }
    catch { error(source, `invalid URL encoding ${value}`); return; }
    if (relative(root, file).split(sep).includes('..')) {
      error(source, `URL escapes _site: ${value}`);
      return;
    }
    if (url.pathname.endsWith('/')) file = resolve(file, 'index.html');
    try {
      if (!statSync(file).isFile()) throw new Error('not a file');
    } catch {
      error(source, `missing ${value} in _site`);
      return;
    }
    checked++;
    return { file, url };
  }

  function css(text, base, source) {
    for (const match of text.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/gi)) {
      reference(match[1] ?? match[2] ?? match[3], base, source);
    }
  }

  function script(text, base, source, data, scriptURL = base) {
    const tree = parseJS(text, { ecmaVersion: 'latest', sourceType: 'module' });
    const constants = new Map();
    simple(tree, { VariableDeclaration(node) {
      if (node.kind === 'const') for (const declaration of node.declarations) {
        if (declaration.id.type === 'Identifier') {
          const name = declaration.id.name;
          constants.set(name, constants.has(name) ? null : declaration.init);
        }
      }
    } });
    const property = node => node?.computed ? node.property.value : node?.property?.name;
    function values(node, seen = new Set()) {
      if (!node || seen.has(node)) return null;
      seen = new Set(seen).add(node);
      if (node.type === 'Literal' && typeof node.value === 'string') return [node.value];
      if (node.type === 'TemplateLiteral' && !node.expressions.length) return [node.quasis[0].value.cooked];
      if (node.type === 'Identifier') return values(constants.get(node.name), seen);
      if (node.type === 'MemberExpression' && property(node.object) === 'dataset') {
        return data.get(property(node)) ?? null;
      }
      if (node.type === 'LogicalExpression') {
        // && guards a URL; || and ?? select between URL alternatives.
        if (node.operator === '&&') return values(node.right, seen);
        const left = values(node.left, seen), right = values(node.right, seen);
        return left && right ? [...left, ...right] : null;
      }
      if (node.type === 'ConditionalExpression') {
        const yes = values(node.consequent, seen), no = values(node.alternate, seen);
        return yes && no ? [...yes, ...no] : null;
      }
      if (node.type === 'BinaryExpression' && node.operator === '+') {
        const left = values(node.left, seen), right = values(node.right, seen);
        return left && right ? left.flatMap(a => right.map(b => a + b)) : null;
      }
      return null;
    }
    function resource(node, kind) {
      const urls = values(node);
      if (!urls) { error(source, `cannot resolve ${kind} URL statically`); return; }
      for (const url of urls) {
        const refs = kind === 'srcset' ? parseSrcset(url).map(candidate => candidate.url) : [url];
        for (const ref of refs) reference(ref, base, source);
      }
    }
    function imported(node) {
      const found = reference(node.value, scriptURL, source);
      if (found) externalScript(found, base, data);
    }
    simple(tree, {
      CallExpression(node) {
        const name = node.callee.name ?? property(node.callee);
        if (name === 'fetch') resource(node.arguments[0], 'fetch');
        if (name === 'setAttribute' && (attrs.has(node.arguments[0]?.value) || node.arguments[0]?.value === 'srcset')) {
          resource(node.arguments[1], node.arguments[0].value);
        }
      },
      AssignmentExpression(node) {
        if (node.left.type === 'MemberExpression' && (attrs.has(property(node.left)) || property(node.left) === 'srcset')) {
          resource(node.right, property(node.left));
        }
      },
      ImportDeclaration(node) { imported(node.source); },
      ExportNamedDeclaration(node) { if (node.source) imported(node.source); },
      ExportAllDeclaration(node) { imported(node.source); },
      ImportExpression(node) {
        const urls = values(node.source);
        if (!urls) error(source, 'cannot resolve import URL statically');
        else for (const url of urls) imported({ value: url });
      },
    });
  }

  function externalScript(found, base, data) {
    const key = `${found.file}:${base}`;
    if (visited.has(key)) return;
    visited.add(key);
    script(readFileSync(found.file, 'utf8'), base, relative(root, found.file), data, found.url);
  }

  for (const page of ['index.html', '404.html', 'play/index.html']) {
    const base = new URL(page, `${origin}/`);
    const found = reference(page, `${origin}/`, page);
    if (!found) continue;
    const tree = parseHTML(readFileSync(found.file, 'utf8'));
    const nodes = [];
    function collect(node) {
      nodes.push(node);
      for (const child of node.childNodes ?? []) collect(child);
      if (node.content) collect(node.content);
    }
    collect(tree);
    const data = new Map();
    for (const node of nodes) for (const { name, value } of node.attrs ?? []) {
      if (name.startsWith('data-')) {
        const key = name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        data.set(key, [...(data.get(key) ?? []), value]);
      }
    }
    for (const node of nodes) {
      for (const { name, value } of node.attrs ?? []) {
        if (name === 'href' && node.tagName === 'base') {
          error(page, 'base href is unsupported; keep site URLs relative to the page');
        }
        if (attrs.has(name) || /^data-(src|poster)(-wide)?$/.test(name)) {
          const asset = reference(value, base, page);
          if (asset && node.tagName === 'script' && name === 'src') externalScript(asset, base, data);
          if (asset && node.tagName === 'link' && asset.url.pathname.endsWith('.css')) {
            css(readFileSync(asset.file, 'utf8'), asset.url, relative(root, asset.file));
          }
        }
        if (name === 'srcset') for (const candidate of parseSrcset(value)) reference(candidate.url, base, page);
        if (name === 'style') css(value, base, page);
      }
      const text = (node.childNodes ?? []).map(child => child.value ?? '').join('');
      if (node.tagName === 'style') css(text, base, page);
      if (node.tagName === 'script' && !node.attrs.some(attr => attr.name === 'src')) {
        const type = node.attrs.find(attr => attr.name === 'type')?.value;
        if (!type || ['module', 'text/javascript', 'application/javascript'].includes(type)) script(text, base, page, data);
      }
    }
  }
  return { errors: [...errors], checked };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { errors, checked } = checkSite(process.argv[2] ?? '_site');
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
  } else console.log(`Deployed references: ok (${checked} local references)`);
}
