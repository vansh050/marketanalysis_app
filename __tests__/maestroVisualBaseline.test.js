const fs = require('fs');
const os = require('os');
const path = require('path');
const { PNG } = require('pngjs');
const { comparePngs } = require('../scripts/compare-maestro-screenshots');

const writePng = (file, color) => {
  const png = new PNG({ width: 10, height: 10 });
  for (let offset = 0; offset < png.data.length; offset += 4) {
    png.data[offset] = color[0];
    png.data[offset + 1] = color[1];
    png.data[offset + 2] = color[2];
    png.data[offset + 3] = 255;
  }
  fs.writeFileSync(file, PNG.sync.write(png));
};

describe('Maestro visual baseline comparison', () => {
  let directory;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'maestro-visual-'));
  });

  afterEach(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  test('accepts an identical screenshot', () => {
    const baseline = path.join(directory, 'baseline.png');
    const actual = path.join(directory, 'actual.png');
    writePng(baseline, [20, 40, 60]);
    writePng(actual, [20, 40, 60]);

    expect(comparePngs(actual, baseline, path.join(directory, 'diff.png'))).toEqual(
      expect.objectContaining({ passed: true, diffPixels: 0 }),
    );
  });

  test('rejects a material visual change and writes a diff', () => {
    const baseline = path.join(directory, 'baseline.png');
    const actual = path.join(directory, 'actual.png');
    const diff = path.join(directory, 'diff.png');
    writePng(baseline, [20, 40, 60]);
    writePng(actual, [220, 40, 60]);

    expect(comparePngs(actual, baseline, diff)).toEqual(
      expect.objectContaining({ passed: false, diffPixels: 100 }),
    );
    expect(fs.statSync(diff).size).toBeGreaterThan(0);
  });
});
