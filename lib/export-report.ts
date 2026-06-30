export type ReportExportFormat = 'csv' | 'pdf' | 'excel';

function escapeCsv(value: string | number | null | undefined): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function buildHtmlTable(title: string, headers: string[], rows: (string | number)[][]): string {
  const head = headers.map((h) => `<th style="padding:8px;border:1px solid #ccc;background:#f3f4f6;text-align:left">${h}</th>`).join('');
  const body = rows
    .map(
      (row) =>
        `<tr>${row.map((c) => `<td style="padding:8px;border:1px solid #ccc">${String(c ?? '')}</td>`).join('')}</tr>`,
    )
    .join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head><body><h1>${title}</h1><table style="border-collapse:collapse;width:100%">${head ? `<thead><tr>${head}</tr></thead>` : ''}<tbody>${body}</tbody></table></body></html>`;
}

/** Export tabular report data as CSV, Excel-compatible HTML (.xls), or PDF via print dialog. */
export function exportReportTable(
  format: ReportExportFormat,
  filename: string,
  title: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
): void {
  const safeName = filename.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase() || 'report';
  const date = new Date().toISOString().slice(0, 10);
  const normalizedRows = rows.map((row) => row.map((c) => c ?? ''));

  if (format === 'csv') {
    const csv = [headers.map(escapeCsv).join(',')]
      .concat(normalizedRows.map((row) => row.map(escapeCsv).join(',')))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  const html = buildHtmlTable(title, headers, normalizedRows as (string | number)[][]);

  if (format === 'excel') {
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}-${date}.xls`;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  const printWindow = window.open('', '_blank', 'noopener,noreferrer');
  if (!printWindow) {
    window.alert('Allow pop-ups to export PDF, or choose CSV/Excel instead.');
    return;
  }
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.onload = () => {
    printWindow.print();
  };
}
