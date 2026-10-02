#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const recast = require('recast');
const babelParser = require('recast/parsers/babel');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const TARGET = path.join(SRC, 'design', 'literalTokens');
const EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);
const SKIP_DIRS = new Set(['__tests__', '__mocks__', 'theme', 'themes', 'tokens']);
const HEX = /^#([0-9a-f]{3,8})$/i;

const walk = (directory, files = []) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name) && target !== path.dirname(TARGET)) walk(target, files);
    } else if (EXTENSIONS.has(path.extname(entry.name))) {
      files.push(target);
    }
  }
  return files;
};

const isFontFamilyProperty = node => {
  const key = node?.key;
  return key?.name === 'fontFamily' || key?.value === 'fontFamily';
};

const relativeImport = file => {
  let relative = path.relative(path.dirname(file), TARGET).replace(/\\/g, '/');
  if (!relative.startsWith('.')) relative = `./${relative}`;
  return relative;
};

let filesChanged = 0;
let colorsChanged = 0;
let fontsChanged = 0;

for (const file of walk(SRC)) {
  const originalSource = fs.readFileSync(file, 'utf8');
  // v1 of this codemod replaced JSX string attributes as bare calls
  // (`color=designColor('fff')`). Repair that shape before parsing so the
  // codemod is safe to rerun on a partially migrated worktree.
  const source = originalSource
    .replace(/=designColor\((['"][0-9a-f]{3,8}['"])\)/gi, '={designColor($1)}')
    .replace(/=designFont\((['"][^'"\n]+['"])\)/g, '={designFont($1)}');
  const repairedInvalidJsx = source !== originalSource;
  let ast;
  try {
    ast = recast.parse(source, { parser: babelParser });
  } catch (error) {
    console.error(`Unable to parse ${path.relative(ROOT, file)}: ${error.message}`);
    process.exitCode = 1;
    continue;
  }
  let needsColor = false;
  let needsFont = false;
  const importPath = relativeImport(file);
  const existingImport = ast.program.body.find(
    node => node.type === 'ImportDeclaration' && node.source?.value === importPath,
  );

  const buildTemplate = value => {
    const quasis = [];
    const expressions = [];
    const pattern = /#([0-9a-f]{3,8})\b/ig;
    let cursor = 0;
    let match;
    while ((match = pattern.exec(value))) {
      const before = value.slice(cursor, match.index);
      quasis.push(recast.types.builders.templateElement({raw: before, cooked: before}, false));
      expressions.push(
        recast.types.builders.callExpression(
          recast.types.builders.identifier('designColor'),
          [recast.types.builders.stringLiteral(match[1].toLowerCase())],
        ),
      );
      needsColor = true;
      colorsChanged += 1;
      cursor = match.index + match[0].length;
    }
    const tail = value.slice(cursor);
    quasis.push(recast.types.builders.templateElement({raw: tail, cooked: tail}, true));
    return recast.types.builders.templateLiteral(quasis, expressions);
  };

  const replaceString = (nodePath) => {
    const value = nodePath.node.value;
    const color = typeof value === 'string' ? value.match(HEX) : null;
    if (color) {
      const call = recast.types.builders.callExpression(
        recast.types.builders.identifier('designColor'),
        [recast.types.builders.stringLiteral(color[1].toLowerCase())],
      );
      if (nodePath.parent?.node?.type === 'JSXAttribute') {
        nodePath.parent.node.value = recast.types.builders.jsxExpressionContainer(call);
      } else {
        nodePath.replace(call);
      }
      needsColor = true;
      colorsChanged += 1;
      return true;
    }
    const parent = nodePath.parent?.node;
    if (
      typeof value === 'string' && value &&
      ((parent?.type === 'ObjectProperty' || parent?.type === 'Property') &&
        parent.value === nodePath.node && isFontFamilyProperty(parent))
    ) {
      nodePath.replace(
        recast.types.builders.callExpression(
          recast.types.builders.identifier('designFont'),
          [recast.types.builders.stringLiteral(value)],
        ),
      );
      needsFont = true;
      fontsChanged += 1;
      return true;
    }
    if (typeof value === 'string' && /#[0-9a-f]{3,8}\b/i.test(value)) {
      const template = buildTemplate(value);
      if (nodePath.parent?.node?.type === 'JSXAttribute') {
        nodePath.parent.node.value = recast.types.builders.jsxExpressionContainer(template);
      } else {
        nodePath.replace(template);
      }
      return true;
    }
    return false;
  };

  recast.types.visit(ast, {
    visitStringLiteral(nodePath) {
      if (replaceString(nodePath)) return false;
      this.traverse(nodePath);
    },
    visitLiteral(nodePath) {
      if (replaceString(nodePath)) return false;
      this.traverse(nodePath);
    },
    visitTemplateLiteral(nodePath) {
      const node = nodePath.node;
      if (!node.quasis.some(quasi => /#[0-9a-f]{3,8}\b/i.test(quasi.value.raw))) {
        this.traverse(nodePath);
        return;
      }
      const quasis = [];
      const expressions = [];
      node.quasis.forEach((quasi, index) => {
        const raw = quasi.value.raw;
        const pattern = /#([0-9a-f]{3,8})\b/ig;
        let cursor = 0;
        let match;
        while ((match = pattern.exec(raw))) {
          const before = raw.slice(cursor, match.index);
          quasis.push(recast.types.builders.templateElement({ raw: before, cooked: before }, false));
          expressions.push(
            recast.types.builders.callExpression(
              recast.types.builders.identifier('designColor'),
              [recast.types.builders.stringLiteral(match[1].toLowerCase())],
            ),
          );
          needsColor = true;
          colorsChanged += 1;
          cursor = match.index + match[0].length;
        }
        const tail = raw.slice(cursor);
        const isLast = index === node.quasis.length - 1;
        quasis.push(recast.types.builders.templateElement({ raw: tail, cooked: tail }, isLast));
        if (!isLast) expressions.push(node.expressions[index]);
      });
      nodePath.replace(recast.types.builders.templateLiteral(quasis, expressions));
      return false;
    },
    visitJSXAttribute(nodePath) {
      const node = nodePath.node;
      if (
        node.name?.name === 'fontFamily' &&
        node.value?.type === 'StringLiteral'
      ) {
        node.value = recast.types.builders.jsxExpressionContainer(
          recast.types.builders.callExpression(
            recast.types.builders.identifier('designFont'),
            [recast.types.builders.stringLiteral(node.value.value)],
          ),
        );
        needsFont = true;
        fontsChanged += 1;
      }
      this.traverse(nodePath);
    },
  });

  if (!needsColor && !needsFont && !repairedInvalidJsx) continue;
  const requested = [needsColor && 'designColor', needsFont && 'designFont'].filter(Boolean);
  if (existingImport) {
    const present = new Set(existingImport.specifiers.map(specifier => specifier.imported?.name));
    for (const name of requested) {
      if (!present.has(name)) {
        existingImport.specifiers.push(
          recast.types.builders.importSpecifier(recast.types.builders.identifier(name)),
        );
      }
    }
  } else {
    const specifiers = requested.map(name =>
      recast.types.builders.importSpecifier(recast.types.builders.identifier(name)),
    );
    const declaration = recast.types.builders.importDeclaration(
      specifiers,
      recast.types.builders.stringLiteral(importPath),
    );
    const body = ast.program.body;
    const insertAt = body.findIndex(node => node.type !== 'ImportDeclaration');
    body.splice(insertAt < 0 ? body.length : insertAt, 0, declaration);
  }
  fs.writeFileSync(file, recast.print(ast, { quote: 'single' }).code);
  filesChanged += 1;
}

console.log(`Design literal codemod: ${filesChanged} files, ${colorsChanged} colors, ${fontsChanged} fonts.`);
if (process.exitCode) process.exit(process.exitCode);
