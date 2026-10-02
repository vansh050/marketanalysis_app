const INDIA_OFFSET_MS = 330 * 60 * 1000;

const pad2 = value => String(value).padStart(2, '0');

const buildDateOnly = (year, month, day) => {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (![y, m, d].every(Number.isInteger)) return '';

  const candidate = new Date(Date.UTC(y, m - 1, d));
  if (
    candidate.getUTCFullYear() !== y ||
    candidate.getUTCMonth() + 1 !== m ||
    candidate.getUTCDate() !== d
  ) {
    return '';
  }

  return `${y}-${pad2(m)}-${pad2(d)}`;
};

const dateOnlyInIndia = date => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const indiaDate = new Date(date.getTime() + INDIA_OFFSET_MS);
  return buildDateOnly(
    indiaDate.getUTCFullYear(),
    indiaDate.getUTCMonth() + 1,
    indiaDate.getUTCDate(),
  );
};

/**
 * Returns the calendar DOB expected by the KRA API (YYYY-MM-DD).
 *
 * Date-picker values are already calendar selections, so their local date
 * parts are preserved. API/database ISO timestamps are instants; those are
 * resolved at India's UTC+05:30 boundary because KRA DOBs are Indian calendar
 * dates. This prevents legacy Indian-midnight values such as
 * 2003-07-04T18:30:00.000Z from being submitted as the previous day.
 */
export const normalizeKraDob = value => {
  if (!value) return '';

  if (value instanceof Date) {
    return buildDateOnly(
      value.getFullYear(),
      value.getMonth() + 1,
      value.getDate(),
    );
  }

  const input = String(value).trim();
  if (!input) return '';

  let match = input.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) return buildDateOnly(match[1], match[2], match[3]);

  match = input.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (match) return buildDateOnly(match[3], match[2], match[1]);

  match = input.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (match) return buildDateOnly(match[3], match[2], match[1]);

  return dateOnlyInIndia(new Date(input));
};
