export type CsvValue = string | number | boolean | null | undefined;

function escapeCsvValue(value: CsvValue): string {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: CsvValue[][],
): void {
  const csv = [headers, ...rows]
    .map((row) => row.map(escapeCsvValue).join(","))
    .join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
