export const normalizePdfBase64 = value => {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .replace(/^data:application\/pdf;base64,/i, '')
    .replace(/\s+/g, '');
};

export const firstReportUrl = report => {
  const candidates = [
    report?.reportLink,
    report?.link,
    report?.pdfPresignedUrl,
    report?.pdfUrl,
    report?.pdfFile?.s3Url,
    ...(Array.isArray(report?.fileUrls) ? report.fileUrls : []),
  ];

  return (
    candidates.find(
      value => typeof value === 'string' && /^https?:\/\//i.test(value),
    ) || ''
  );
};

export const isPdfBase64 = value =>
  normalizePdfBase64(value).startsWith('JVBER');

export const hasDownloadableReport = report =>
  Boolean(report?.pdfPresignedUrl || isPdfBase64(report?.pdfBase64));

export const formatReportDateTime = value => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  const formatted = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
  return `${formatted} IST`;
};

export const mergeReportsById = reports => {
  const reportMap = new Map();

  reports.forEach(report => {
    const key = report?.reportId || report?._id;
    if (!key) return;

    const existing = reportMap.get(key);
    if (!existing) {
      reportMap.set(key, report);
      return;
    }

    // Keep the first source's metadata precedence, but never let an
    // assetless duplicate hide a valid URL/base64 supplied by a later source.
    reportMap.set(key, {
      ...report,
      ...existing,
      pdfPresignedUrl:
        existing.pdfPresignedUrl || report.pdfPresignedUrl || '',
      pdfBase64: existing.pdfBase64 || report.pdfBase64 || '',
    });
  });

  return Array.from(reportMap.values()).filter(hasDownloadableReport);
};
