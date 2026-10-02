import fs from 'fs';
import path from 'path';

describe('repair execution verification UX', () => {
  test('handles every RECHECK_UNAVAILABLE before toast and TPIN paths', () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        '../../components/AdviceScreenComponents/RebalanceModal.js',
      ),
      'utf8',
    );
    const branches = source.match(/data\?\.code === 'RECHECK_UNAVAILABLE'/g) || [];
    expect(branches).toHaveLength(2);

    for (const marker of [
      '[FyersPublisher] Error:',
      '.catch(error => {',
    ]) {
      const start = source.lastIndexOf(marker);
      const quietBranch = source.indexOf(
        "data?.code === 'RECHECK_UNAVAILABLE'",
        start,
      );
      const nextToast = source.indexOf('Toast.show(', quietBranch);
      const branchEnd = source.indexOf('// Frozen-plan 409', quietBranch);
      const branchSource = source.slice(quietBranch, branchEnd);

      expect(quietBranch).toBeGreaterThan(start);
      expect(nextToast).toBeGreaterThan(branchEnd);
      expect(branchSource).toContain('getRebalanceRepair()');
      expect(branchSource).toContain('setOpenRebalanceModal(false)');
      expect(branchSource).not.toContain('Toast.show');
    }
  });
});
