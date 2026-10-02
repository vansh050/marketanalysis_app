#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const pixelmatch = require('pixelmatch');
const { PNG } = require('pngjs');

const SURFACES = ['home', 'news', 'portfolio', 'subscriptions', 'model-portfolio'];

const readPng = (file) => PNG.sync.read(fs.readFileSync(file));

const comparePngs = (actualFile, baselineFile, diffFile, options = {}) => {
  const threshold = Number(options.threshold ?? process.env.VISUAL_PIXEL_THRESHOLD ?? 0.1);
  const maxDiffRatio = Number(
    options.maxDiffRatio ?? process.env.VISUAL_MAX_DIFF_RATIO ?? 0.015,
  );
  const actual = readPng(actualFile);
  const baseline = readPng(baselineFile);

  if (actual.width !== baseline.width || actual.height !== baseline.height) {
    return {
      passed: false,
      reason: `dimensions changed: ${baseline.width}x${baseline.height} -> ${actual.width}x${actual.height}`,
      diffPixels: actual.width * actual.height,
      diffRatio: 1,
    };
  }

  const diff = new PNG({ width: actual.width, height: actual.height });
  const diffPixels = pixelmatch(
    baseline.data,
    actual.data,
    diff.data,
    actual.width,
    actual.height,
    { threshold },
  );
  const diffRatio = diffPixels / (actual.width * actual.height);
  fs.mkdirSync(path.dirname(diffFile), { recursive: true });
  fs.writeFileSync(diffFile, PNG.sync.write(diff));

  return {
    passed: diffRatio <= maxDiffRatio,
    reason: `${diffPixels} pixels changed (${(diffRatio * 100).toFixed(3)}%; allowed ${(maxDiffRatio * 100).toFixed(3)}%)`,
    diffPixels,
    diffRatio,
  };
};

const main = () => {
  const actualDir = path.resolve(process.argv[2] || 'artifacts/design-variants/default');
  const baselineDir = path.resolve(
    process.argv[3] || '.maestro/design-variants/baselines/default',
  );
  const diffDir = path.resolve(process.argv[4] || 'artifacts/design-variants/diffs/default');
  const update = process.env.UPDATE_VISUAL_BASELINES === '1';
  let failures = 0;

  for (const surface of SURFACES) {
    const actualFile = path.join(actualDir, `${surface}.png`);
    const baselineFile = path.join(baselineDir, `${surface}.png`);
    const diffFile = path.join(diffDir, `${surface}.png`);

    if (!fs.existsSync(actualFile) || fs.statSync(actualFile).size === 0) {
      console.error(`MISSING_SCREENSHOT ${actualFile}`);
      failures += 1;
      continue;
    }

    if (update) {
      fs.mkdirSync(baselineDir, { recursive: true });
      fs.copyFileSync(actualFile, baselineFile);
      console.log(`UPDATED_BASELINE ${surface}: ${baselineFile}`);
      continue;
    }

    if (!fs.existsSync(baselineFile)) {
      console.error(
        `MISSING_BASELINE ${baselineFile} (capture and approve it with UPDATE_VISUAL_BASELINES=1)`,
      );
      failures += 1;
      continue;
    }

    const result = comparePngs(actualFile, baselineFile, diffFile);
    console.log(`${result.passed ? 'VISUAL_PASS' : 'VISUAL_REGRESSION'} ${surface}: ${result.reason}`);
    if (!result.passed) failures += 1;
  }

  if (failures > 0) {
    console.error(`Maestro visual comparison failed for ${failures} surface(s).`);
    process.exitCode = 1;
  } else if (update) {
    console.log(`Updated ${SURFACES.length} Maestro visual baselines in ${baselineDir}.`);
  } else {
    console.log(`Maestro visual baselines passed for ${SURFACES.length} surfaces.`);
  }
};

if (require.main === module) main();

module.exports = { comparePngs, SURFACES };
