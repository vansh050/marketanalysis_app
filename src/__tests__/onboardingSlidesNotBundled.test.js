/**
 * The phone-first onboarding clips (~16 MB) were arfs's own and were bundled
 * into every app although only arfs enables the flow. The shared default must
 * stay empty and ship no video files; arfs_app keeps its clips locally
 * (2026-10-16).
 */
import fs from 'fs';
import path from 'path';
import {DEFAULT_ASSETS} from '../theme/assets';

const walk = dir =>
  fs.readdirSync(dir, {withFileTypes: true}).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });

test('shared default onboarding carousel is empty', () => {
  expect(DEFAULT_ASSETS.onboardingSlides).toEqual([]);
});

test('no video files are bundled from src/assets', () => {
  const videos = walk(path.join(__dirname, '..', 'assets')).filter(f =>
    /\.(mp4|mov|m4v|webm)$/i.test(f),
  );
  expect(videos).toEqual([]);
});
