/* eslint-env node */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dotenv = require('dotenv');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_ENV_PATH = path.join(ROOT, '.env');
const TOKEN_MODULE_SUFFIX = '/design/literalTokens';
const SAFE_COLOR = /^[0-9a-f]{3,8}$/i;

const parseEnvFile = (envPath = DEFAULT_ENV_PATH) => {
  try {
    return dotenv.parse(fs.readFileSync(envPath));
  } catch (error) {
    if (error?.code === 'ENOENT') {return {};}
    throw error;
  }
};

const resolveVariant = ({
  envPath = DEFAULT_ENV_PATH,
  processEnv = process.env,
} = {}) => {
  const fileEnv = parseEnvFile(envPath);
  return (
    processEnv.DESIGN_VARIANT ||
    fileEnv.DESIGN_VARIANT ||
    processEnv.APP_VARIANT ||
    fileEnv.APP_VARIANT ||
    'default'
  );
};

const literalPath = variant =>
  path.join(ROOT, 'designs', variant, 'tokens', 'literals.json');

const readLiteralFile = target => {
  if (!fs.existsSync(target)) {return {};}
  return JSON.parse(fs.readFileSync(target, 'utf8'));
};

const loadOverrides = options => {
  const variant = resolveVariant(options);
  const defaults = readLiteralFile(literalPath('default'));
  const selected =
    variant === 'default' ? {} : readLiteralFile(literalPath(variant));
  const parsed = {
    colors: {...(defaults.colors || {}), ...(selected.colors || {})},
    fonts: {...(defaults.fonts || {}), ...(selected.fonts || {})},
  };
  const colors = Object.fromEntries(
    Object.entries(parsed.colors || {}).map(([key, value]) => [key.toLowerCase(), value]),
  );
  return {variant, colors, fonts: parsed.fonts || {}};
};

const getDesignLiteralCacheKey = options => {
  const variant = resolveVariant(options);
  const hash = crypto.createHash('sha256');
  hash.update(`variant:${variant}\0`);
  hash.update(fs.readFileSync(__filename));

  const files = [literalPath('default')];
  if (variant !== 'default') {files.push(literalPath(variant));}
  for (const file of files) {
    hash.update(`\0file:${path.relative(ROOT, file)}\0`);
    if (fs.existsSync(file)) {hash.update(fs.readFileSync(file));}
  }

  return `design-literals-${hash.digest('hex')}`;
};

const designLiteralsPlugin = ({ types: t }) => ({
  name: 'alphaquark-design-literals',
  pre() {
    this.designLiteralImports = [];
    this.designColorNames = new Set();
    this.designFontNames = new Set();
    this.designLiteralOverrides = loadOverrides({envPath: this.opts?.envPath});
  },
  visitor: {
    ImportDeclaration(pathRef) {
      const source = pathRef.node.source.value.replace(/\\/g, '/');
      if (!source.endsWith(TOKEN_MODULE_SUFFIX)) {return;}
      for (const specifier of pathRef.node.specifiers) {
        const imported = specifier.imported?.name;
        if (imported === 'designColor') {this.designColorNames.add(specifier.local.name);}
        if (imported === 'designFont') {this.designFontNames.add(specifier.local.name);}
      }
      this.designLiteralImports.push(pathRef);
    },
    CallExpression(pathRef) {
      const { callee, arguments: args } = pathRef.node;
      if (!t.isIdentifier(callee) || args.length !== 1 || !t.isStringLiteral(args[0])) {return;}
      if (this.designColorNames.has(callee.name)) {
        const key = args[0].value.toLowerCase();
        if (!SAFE_COLOR.test(key)) {
          throw pathRef.buildCodeFrameError(`Invalid designColor key: ${key}`);
        }
        const override = this.designLiteralOverrides.colors[key];
        pathRef.replaceWith(t.stringLiteral(override || `#${key}`));
      } else if (this.designFontNames.has(callee.name)) {
        const font = args[0].value;
        pathRef.replaceWith(t.stringLiteral(this.designLiteralOverrides.fonts[font] || font));
      }
    },
    Program: {
      exit() {
        for (const importPath of this.designLiteralImports) {importPath.remove();}
      },
    },
  },
});

module.exports = designLiteralsPlugin;
module.exports.parseEnvFile = parseEnvFile;
module.exports.resolveVariant = resolveVariant;
module.exports.loadOverrides = loadOverrides;
module.exports.getDesignLiteralCacheKey = getDesignLiteralCacheKey;
