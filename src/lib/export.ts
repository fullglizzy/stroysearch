/**
 * Экспорт данных в CSV и скачивание файла
 */

export function exportToCSV(
  rows: Record<string, unknown>[],
  columns: { key: string; label: string }[],
  filename: string,
) {
  // BOM для корректного открытия в Excel с кириллицей
  const BOM = "\uFEFF";

  // Заголовок
  const header = columns.map((c) => `"${c.label}"`).join(";");

  // Строки данных
  const dataLines = rows.map((row) =>
    columns
      .map((c) => {
        const val = row[c.key];
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      })
      .join(";"),
  );

  const csv = BOM + [header, ...dataLines].join("\n");

  // Скачивание
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
