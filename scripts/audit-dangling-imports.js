#!/usr/bin/env node
/**
 * dangling-import-audit.js
 *
 * Finds NAMED imports from LOCAL modules where the target module does not
 * actually export that name — the defect class that shipped a live crash in 5
 * of 7 RN forks (`describeCashfreeDecline` imported at 3 call sites while
 * defined nowhere, throwing only on the payment-decline path).
 *
 * AST-based on purpose. A grep-based audit is what let the original hole hide:
 * a single-line `import {x} from` pattern silently misses multi-line
 * `import {\n x,\n y\n}` blocks, producing a false all-clear.
 *
 * CONSERVATIVE BY DESIGN — it only reports a dangling import when it is
 * confident, to keep the signal trustworthy. It stays silent when:
 *   - the target module has `export * from ...` that it cannot fully resolve
 *   - the target uses CommonJS (`module.exports` / `exports.x`)
 *   - the target failed to parse
 *   - the specifier is a package, alias, or non-JS asset
 * False negatives are acceptable here; false positives are not.
 *
 * EXIT CODE — this is what makes it usable as a CI gate:
 *   1  if any DANGLING_IMPORT is found (silent runtime failure — must block)
 *   0  if only UNRESOLVED_MODULE findings exist (Metro fails LOUDLY on these if
 *      the file is ever reachable, so they cannot ship silently; they are
 *      reported as warnings). Pass --strict to fail on those too.
 *
 * Usage:
 *   node scripts/audit-dangling-imports.js            # audit this repo
 *   node scripts/audit-dangling-imports.js <repo> ... # audit specific repos
 *   node scripts/audit-dangling-imports.js --strict   # also fail on unresolved
 */
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const EXTS = ['.js', '.jsx', '.ts', '.tsx'];
const SCAN_DIRS = ['src', 'designs', 'app', 'components'];
const SKIP = new Set(['node_modules', '.git', 'android', 'ios', 'build', 'dist', '__tests__', '__snapshots__']);

const PARSE_OPTS = {
  sourceType: 'unambiguous',
  allowReturnOutsideFunction: true,
  errorRecovery: true,
  plugins: [
    'jsx', 'typescript', 'classProperties', 'objectRestSpread',
    'optionalChaining', 'nullishCoalescingOperator', 'dynamicImport',
    'exportDefaultFrom', 'exportNamespaceFrom', 'decorators-legacy',
  ],
};

function walk(dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (SKIP.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (EXTS.includes(path.extname(e.name))) out.push(full);
  }
  return out;
}

function parseFile(file) {
  try {
    return parser.parse(fs.readFileSync(file, 'utf8'), PARSE_OPTS);
  } catch {
    return null;
  }
}

/** Resolve a relative specifier to a real file, mirroring Metro resolution. */
function resolve(fromFile, spec) {
  const base = path.resolve(path.dirname(fromFile), spec);
  for (const ext of ['', ...EXTS]) {
    const p = base + ext;
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  }
  for (const ext of EXTS) {
    const p = path.join(base, 'index' + ext);
    if (fs.existsSync(p)) return p;
  }
  // platform-specific variants
  for (const v of ['.native', '.android', '.ios']) {
    for (const ext of EXTS) {
      const p = base + v + ext;
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

/** Collect what a module exports. Returns null if we can't be confident. */
const exportCache = new Map();
function getExports(file, depth = 0) {
  if (exportCache.has(file)) return exportCache.get(file);
  if (depth > 4) return null; // give up on deep re-export chains
  const ast = parseFile(file);
  if (!ast) { exportCache.set(file, null); return null; }

  const names = new Set();
  let unresolvedStar = false;
  let commonjs = false;
  const src = fs.readFileSync(file, 'utf8');
  if (/module\.exports|exports\.[A-Za-z_$]/.test(src)) commonjs = true;

  for (const node of ast.program.body) {
    if (node.type === 'ExportNamedDeclaration') {
      if (node.declaration) {
        const d = node.declaration;
        if (d.id?.name) names.add(d.id.name);
        for (const decl of d.declarations || []) {
          if (decl.id?.name) names.add(decl.id.name);
          // destructured export consts
          for (const p of decl.id?.properties || []) {
            if (p.key?.name) names.add(p.value?.name || p.key.name);
          }
        }
      }
      for (const s of node.specifiers || []) {
        names.add(s.exported?.name || s.exported?.value);
      }
    } else if (node.type === 'ExportDefaultDeclaration') {
      names.add('default');
    } else if (node.type === 'ExportAllDeclaration') {
      // export * from './x' — try to resolve transitively
      const target = node.source?.value && node.source.value.startsWith('.')
        ? resolve(file, node.source.value) : null;
      const sub = target ? getExports(target, depth + 1) : null;
      if (sub && !sub.unknown) for (const n of sub.names) names.add(n);
      else unresolvedStar = true;
    }
  }

  const result = { names, unknown: unresolvedStar || commonjs };
  exportCache.set(file, result);
  return result;
}

function auditRepo(repo) {
  const findings = [];
  let filesScanned = 0, importsChecked = 0;

  const roots = SCAN_DIRS.map(d => path.join(repo, d)).filter(d => fs.existsSync(d));
  const files = roots.flatMap(r => walk(r));

  for (const file of files) {
    const ast = parseFile(file);
    if (!ast) continue;
    filesScanned++;

    for (const node of ast.program.body) {
      if (node.type !== 'ImportDeclaration') continue;
      const spec = node.source.value;
      if (!spec.startsWith('.')) continue; // package import — out of scope
      const target = resolve(file, spec);
      if (!target) {
        // unresolvable local path — a different (also real) defect class
        findings.push({
          kind: 'UNRESOLVED_MODULE', file, line: node.loc.start.line,
          name: spec, detail: 'local import path resolves to no file',
        });
        continue;
      }
      const exp = getExports(target);
      if (!exp || exp.unknown) continue; // can't be confident — stay silent

      for (const s of node.specifiers) {
        if (s.type !== 'ImportSpecifier') continue; // default/namespace: skip
        const imported = s.imported?.name || s.imported?.value;
        if (!imported) continue;
        importsChecked++;
        if (!exp.names.has(imported)) {
          findings.push({
            kind: 'DANGLING_IMPORT', file, line: node.loc.start.line,
            name: imported, detail: `not exported by ${path.relative(repo, target)}`,
          });
        }
      }
    }
  }
  return { findings, filesScanned, importsChecked };
}

const args = process.argv.slice(2);
const STRICT = args.includes('--strict');
const repos = args.filter(a => !a.startsWith('--'));
if (repos.length === 0) repos.push(path.resolve(__dirname, '..')); // default: this repo

let totalDangling = 0, totalUnresolved = 0;
for (const repo of repos) {
  const name = path.basename(path.resolve(repo));
  const { findings, filesScanned, importsChecked } = auditRepo(repo);
  const dangling = findings.filter(f => f.kind === 'DANGLING_IMPORT');
  const unresolved = findings.filter(f => f.kind === 'UNRESOLVED_MODULE');
  totalDangling += dangling.length;
  totalUnresolved += unresolved.length;

  const status = dangling.length === 0
    ? (unresolved.length === 0 ? '✅ clean' : `✅ 0 dangling (${unresolved.length} unresolved warnings)`)
    : `🔴 ${dangling.length} DANGLING, ${unresolved.length} unresolved`;
  console.log(`\n── ${name}  (${filesScanned} files, ${importsChecked} named local imports)  ${status}`);
  for (const f of dangling) {
    console.log(`   🔴 ${f.name}  — ${f.detail}`);
    console.log(`      ${path.relative(repo, f.file)}:${f.line}`);
  }
  for (const f of unresolved) {
    console.log(`   ⚠️  ${f.name}  — ${f.detail}`);
    console.log(`      ${path.relative(repo, f.file)}:${f.line}`);
  }
}

console.log(`\n════ ${totalDangling} dangling · ${totalUnresolved} unresolved ════`);
if (totalDangling > 0) {
  console.error(
    `\n🔴 FAILED: ${totalDangling} named import(s) resolve to a module that does NOT export them.\n` +
    `   These evaluate to \`undefined\` at runtime and fail SILENTLY — only when the\n` +
    `   code path actually runs. This exact class shipped a live crash on the\n` +
    `   payment-decline path in 5 of 7 forks (2026-07-18).\n` +
    `   Fix the import, or export the missing name.`
  );
  process.exit(1);
}
if (STRICT && totalUnresolved > 0) {
  console.error(`\n🔴 FAILED (--strict): ${totalUnresolved} unresolved local module path(s).`);
  process.exit(1);
}
console.log('✅ No dangling imports.');
