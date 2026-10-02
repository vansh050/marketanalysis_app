import {
  formatReportDateTime,
  firstReportUrl,
  hasDownloadableReport,
  isPdfBase64,
  mergeReportsById,
  normalizePdfBase64,
} from '../../utils/researchReportUtils';

describe('researchReportUtils', () => {
  test('formats audit timestamps in an unambiguous 12-hour IST form', () => {
    expect(formatReportDateTime('2026-09-05T14:31:00.000Z')).toBe(
      '5 Sept 2026, 8:01 pm IST',
    );
  });
  test('normalizes raw and data-URL PDF base64', () => {
    expect(normalizePdfBase64('  JVBE\nRi0x  ')).toBe('JVBERi0x');
    expect(
      normalizePdfBase64('data:application/pdf;base64,JVBE Ri0x'),
    ).toBe('JVBERi0x');
    expect(normalizePdfBase64(null)).toBe('');
  });

  test('resolves both recommendation and admin-report URL shapes', () => {
    expect(firstReportUrl({reportLink: 'https://example.test/reco.pdf'})).toBe(
      'https://example.test/reco.pdf',
    );
    expect(firstReportUrl({link: 'https://example.test/admin.pdf'})).toBe(
      'https://example.test/admin.pdf',
    );
    expect(
      firstReportUrl({
        reportLink: null,
        fileUrls: ['not-a-url', 'https://example.test/upload.pdf'],
      }),
    ).toBe('https://example.test/upload.pdf');
  });

  test('rejects assetless rows while retaining embedded PDFs', () => {
    expect(hasDownloadableReport({pdfPresignedUrl: '', pdfBase64: ''})).toBe(
      false,
    );
    expect(hasDownloadableReport({pdfBase64: 'JVBERi0x'})).toBe(true);
    expect(isPdfBase64('this-is-not-a-pdf')).toBe(false);
  });

  test('does not let an assetless duplicate mask a later valid report', () => {
    expect(
      mergeReportsById([
        {reportId: 'same-id', symbol: 'ABC', pdfPresignedUrl: ''},
        {reportId: 'same-id', pdfBase64: 'JVBERi0x'},
        {reportId: 'empty-id', symbol: 'NO_PDF'},
      ]),
    ).toEqual([
      expect.objectContaining({
        reportId: 'same-id',
        symbol: 'ABC',
        pdfBase64: 'JVBERi0x',
      }),
    ]);
  });
});
