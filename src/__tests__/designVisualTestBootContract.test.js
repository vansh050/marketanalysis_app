const fs = require('fs');
const path = require('path');

const read = relativePath =>
  fs.readFileSync(path.join(__dirname, '../..', relativePath), 'utf8');
const exists = relativePath =>
  fs.existsSync(path.join(__dirname, '../..', relativePath));

describe('design visual test boot contract', () => {
  test('the Home-first override requires both visual-build gates', () => {
    const navigation = read('src/components/Navigation.js');

    expect(navigation).toContain("Config?.REACT_APP_DESIGN_VISUAL_TEST_FIRST");
    expect(navigation).toContain("Config?.B2B_DESIGN_VISUAL_BUILD");
    expect(navigation).toMatch(/designVisualTestFirst[\s\S]*?\? 'DesignVisualLauncher'/);
    expect(navigation).toContain("['Open Subscriptions', 'DesignVisualSubscriptions']");
    expect(navigation).toContain("useComponent('screens.MySubscriptionsScreen')");
    expect(navigation).toMatch(/DesignVisualSubscriptions[\s\S]*?loading: false/);
  });

  test('visual workflows opt in and do not use live customer login', () => {
    const hostedVisualFiles = [
      '.github/workflows/android-build.yml',
      '.github/workflows/android-design-visual.yml',
      '.maestro/design-variants/001_customer_design_surfaces.yaml',
    ];
    if (!hostedVisualFiles.some(exists)) {
      expect(hostedVisualFiles.every(file => !exists(file))).toBe(true);
      return;
    }
    expect(hostedVisualFiles.every(exists)).toBe(true);
    const buildWorkflow = read('.github/workflows/android-build.yml');
    const visualWorkflow = read('.github/workflows/android-design-visual.yml');
    const visualFlow = read('.maestro/design-variants/001_customer_design_surfaces.yaml');
    const visualRunner = read('scripts/run-maestro-design-variants.sh');

    expect(buildWorkflow).toContain('ENVFILE: .env.design-visual');
    expect(visualWorkflow).toContain('ENVFILE: .env.design-visual');
    expect(buildWorkflow).toContain('-PdesignVisualTest=true');
    expect(buildWorkflow).toContain("UPDATE_VISUAL_BASELINES: '0'");
    expect(buildWorkflow).toContain('android-design-visual-default');
    expect(buildWorkflow).toContain('sudo chmod 666 /dev/kvm');
    expect(visualWorkflow).toContain('-PdesignVisualTest=true');
    expect(visualFlow).not.toContain('helpers/login.yaml');
    expect(visualFlow).toContain('clearState: true');
    expect(visualFlow).toContain('Open News');
    expect(visualRunner).toContain('-e "APP_ID=$app_id"');
    expect(visualRunner).toContain('-e "DESIGN_VARIANT=$variant"');
    expect(visualRunner).toContain('--debug-output "$maestro_output_dir"');
    expect(visualRunner).toContain('--flatten-debug-output');
    expect(visualFlow).toContain('takeScreenshot: home');
    expect(visualFlow).toContain('name: customer-design-surfaces');
  });

  test('the visual env contains no production configuration', () => {
    const visualEnv = read('.env.design-visual');

    expect(visualEnv.trim().split('\n')).toEqual([
      '# Safe, debug-only input for hosted Maestro screenshot builds.',
      'REACT_APP_DESIGN_VISUAL_TEST_FIRST=true',
    ]);
  });

  test('the hosted-emulator APK bundles JavaScript and only packages x86_64', () => {
    const gradle = read('android/app/build.gradle');

    expect(gradle).toContain('def designVisualTestBuild');
    expect(gradle).toContain('buildConfigField "String", "B2B_DESIGN_VISUAL_BUILD"');
    expect(gradle).toMatch(/designVisualTestBuild[\s\S]*?debuggableVariants = \[\]/);
    expect(gradle).toMatch(/designVisualTestBuild[\s\S]*?abiFilters "x86_64"/);
  });
});
