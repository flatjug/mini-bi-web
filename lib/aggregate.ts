export type CsvRow = Record<string, string>;
export type AggregationType = "count" | "sum" | "avg";
export type ChartType = "bar" | "line" | "pie" | "table";
export type AggregatedDatum = { label: string; value: number };

type AggregateOptions = {
  aggregation: AggregationType;
  xColumn: string;
  yColumn: string;
};

function normalizeCell(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function toNumber(value: string) {
  const cleaned = value.trim().replaceAll(",", "");

  if (!cleaned) {
    return null;
  }

  const numericValue = Number(cleaned);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function formatLabel(value: string) {
  return value || "(empty)";
}

export function normalizeCsvRows(rows: Array<Record<string, unknown>>) {
  return rows
    .map((row) => {
      const nextRow: CsvRow = {};

      for (const [key, value] of Object.entries(row)) {
        nextRow[key] = normalizeCell(value);
      }

      return nextRow;
    })
    .filter((row) => Object.values(row).some((value) => value !== ""));
}

export function extractColumns(rows: CsvRow[]) {
  const seen = new Set<string>();

  rows.forEach((row) => {
    Object.keys(row).forEach((key) => {
      if (key) {
        seen.add(key);
      }
    });
  });

  return Array.from(seen);
}

export function aggregateData(rows: CsvRow[], options: AggregateOptions): AggregatedDatum[] {
  const { aggregation, xColumn, yColumn } = options;

  if (!xColumn) {
    return [];
  }

  if ((aggregation === "sum" || aggregation === "avg") && !yColumn) {
    return [];
  }

  const grouped = new Map<string, { count: number; sum: number }>();

  rows.forEach((row) => {
    const label = formatLabel(normalizeCell(row[xColumn]));
    const current = grouped.get(label) ?? { count: 0, sum: 0 };

    if (aggregation === "count") {
      current.count += 1;
      grouped.set(label, current);
      return;
    }

    const numericValue = toNumber(normalizeCell(row[yColumn]));

    if (numericValue === null) {
      return;
    }

    current.count += 1;
    current.sum += numericValue;
    grouped.set(label, current);
  });

  return Array.from(grouped.entries()).map(([label, entry]) => ({
    label,
    value: aggregation === "avg" ? entry.sum / entry.count : aggregation === "sum" ? entry.sum : entry.count,
  }));
}
