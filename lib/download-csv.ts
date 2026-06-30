/** Trigger a CSV file download in the browser. */
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
): void {
  const escape = (value: string | number | null | undefined) =>
    `"${String(value ?? '').replace(/"/g, '""')}"`;
  const csv = [headers.map(escape).join(',')]
    .concat(rows.map((row) => row.map(escape).join(',')))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Open the user's email client when an address is available. */
export function openMailTo(email: string, subject: string, body?: string): boolean {
  const trimmed = email.trim();
  if (!trimmed || trimmed === '(signed up)' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return false;
  }
  const params = new URLSearchParams();
  if (subject) params.set('subject', subject);
  if (body) params.set('body', body);
  const qs = params.toString();
  window.location.href = `mailto:${encodeURIComponent(trimmed)}${qs ? `?${qs}` : ''}`;
  return true;
}
