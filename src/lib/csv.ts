const cell = (v: unknown) => {
  const s = v == null ? "" : v instanceof Date ? v.toISOString() : String(v);
  // Quote when needed and neutralise spreadsheet formula injection.
  const safe = /^[=+\-@]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function toCsv(headers: string[], rows: unknown[][]) {
  return "﻿" + [headers, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}

export function csvResponse(filename: string, body: string) {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
