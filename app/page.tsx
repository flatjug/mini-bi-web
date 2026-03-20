"use client";

import type { ChangeEvent } from "react";
import { useState } from "react";
import dynamic from "next/dynamic";
import Papa from "papaparse";
import {
  aggregateData,
  extractColumns,
  normalizeCsvRows,
  type AggregationType,
  type ChartType,
  type CsvRow,
} from "../lib/aggregate";

const ChartDisplay = dynamic(() => import("../components/chart-display"), {
  ssr: false,
  loading: () => (
    <div className="panel placeholder">
      <p>Preparing your chart area...</p>
    </div>
  ),
});

const aggregationOptions: Array<{ label: string; value: AggregationType }> = [
  { label: "Count", value: "count" },
  { label: "Sum", value: "sum" },
  { label: "Average", value: "avg" },
];

const chartOptions: Array<{ label: string; value: ChartType }> = [
  { label: "Bar", value: "bar" },
  { label: "Line", value: "line" },
  { label: "Pie", value: "pie" },
  { label: "Table", value: "table" },
];

function getValueLabel(aggregation: AggregationType, yColumn: string) {
  if (aggregation === "count") {
    return "Rows";
  }

  if (!yColumn) {
    return "Value";
  }

  return `${aggregation.toUpperCase()} of ${yColumn}`;
}

export default function HomePage() {
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [parseMessage, setParseMessage] = useState<string | null>(null);
  const [xColumn, setXColumn] = useState("");
  const [yColumn, setYColumn] = useState("");
  const [aggregation, setAggregation] = useState<AggregationType>("count");
  const [chartType, setChartType] = useState<ChartType>("bar");

  const aggregatedData = aggregateData(rows, {
    aggregation,
    xColumn,
    yColumn,
  });

  const isReady = columns.length > 0;
  const chartOptionLabel =
    chartOptions.find((option) => option.value === chartType)?.label ?? chartType;

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setParseMessage(null);

    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const nextRows = normalizeCsvRows(results.data);
        const nextColumns = extractColumns(nextRows);
        const nextXColumn = nextColumns[0] ?? "";
        const nextYColumn = nextColumns[1] ?? nextColumns[0] ?? "";

        if (nextRows.length === 0 || nextColumns.length === 0) {
          setRows([]);
          setColumns([]);
          setFileName(file.name);
          setXColumn("");
          setYColumn("");
          setParseMessage("CSVから読み取れる行がありませんでした。ヘッダ付きのCSVを選んでください。");
          return;
        }

        setRows(nextRows);
        setColumns(nextColumns);
        setFileName(file.name);
        setXColumn(nextXColumn);
        setYColumn(nextYColumn);
        setAggregation("count");
        setChartType("bar");

        if (results.errors.length > 0) {
          setParseMessage(`一部の行を読み飛ばしました: ${results.errors[0]?.message ?? "Unknown parse issue"}`);
          return;
        }

        setParseMessage(`${nextRows.length.toLocaleString()} rows loaded from ${file.name}.`);
      },
      error: (error) => {
        setRows([]);
        setColumns([]);
        setFileName(file.name);
        setXColumn("");
        setYColumn("");
        setParseMessage(`CSVの読み込みに失敗しました: ${error.message}`);
      },
    });
  };

  return (
    <main className="page-shell">
      <section className="hero panel">
        <div className="hero-layout">
          <div>
            <span className="eyebrow">Pocket BI</span>
            <h1>CSV charts that stay on your device.</h1>
            <p className="hero-copy">
              Upload a CSV, choose the columns you want to compare, and switch between
              bar, line, pie, or table views in one screen.
            </p>
            <div className="privacy-note">
              <strong>Privacy:</strong> your CSV is parsed in this browser only and is
              never uploaded by this app.
            </div>
          </div>

          <div className="hero-stats">
            <div className="stat-card">
              <span>Rows</span>
              <strong>{rows.length.toLocaleString()}</strong>
            </div>
            <div className="stat-card">
              <span>Columns</span>
              <strong>{columns.length.toLocaleString()}</strong>
            </div>
            <div className="stat-card stat-card-wide">
              <span>Current view</span>
              <strong>{isReady ? chartOptionLabel : "Waiting for CSV"}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">1. Upload</span>
            <h2>Choose a CSV file</h2>
          </div>
          {fileName ? <span className="status-chip">{fileName}</span> : null}
        </div>

        <label className="file-picker">
          <span className="file-picker-title">Select a CSV file</span>
          <span className="file-picker-caption">
            Tap to browse from Files. Header row is required.
          </span>
          <input accept=".csv,text/csv" onChange={handleFileChange} type="file" />
        </label>

        <div className="micro-stats">
          <div className="micro-stat">
            <span>Privacy</span>
            <strong>Local only</strong>
          </div>
          <div className="micro-stat">
            <span>Storage</span>
            <strong>In-memory</strong>
          </div>
          <div className="micro-stat">
            <span>Ready for charts</span>
            <strong>{isReady ? "Yes" : "Not yet"}</strong>
          </div>
        </div>

        <p className={`message ${parseMessage?.startsWith("CSVの読み込みに失敗") ? "message-error" : ""}`}>
          {parseMessage ?? "No file selected yet."}
        </p>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">2. Configure</span>
            <h2>Pick your columns and chart</h2>
          </div>
          {rows.length > 0 ? (
            <span className="status-chip">{rows.length.toLocaleString()} rows</span>
          ) : null}
        </div>

        <div className="controls-grid">
          <label className="control">
            <span>X axis column</span>
            <select
              disabled={!isReady}
              onChange={(event) => setXColumn(event.target.value)}
              value={xColumn}
            >
              <option value="">Select a column</option>
              {columns.map((column) => (
                <option key={column} value={column}>
                  {column}
                </option>
              ))}
            </select>
          </label>

          <label className="control">
            <span>Y axis column</span>
            <select
              disabled={!isReady}
              onChange={(event) => setYColumn(event.target.value)}
              value={yColumn}
            >
              <option value="">Select a column</option>
              {columns.map((column) => (
                <option key={column} value={column}>
                  {column}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="toggle-grid">
          <div className="toggle-group">
            <span className="toggle-label">Aggregation</span>
            <div className="segmented-control" aria-label="Aggregation selector">
              {aggregationOptions.map((option) => (
                <button
                  className={`segment-button ${aggregation === option.value ? "segment-button-active" : ""}`}
                  disabled={!isReady}
                  key={option.value}
                  onClick={() => setAggregation(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="toggle-group">
            <span className="toggle-label">View type</span>
            <div className="segmented-control" aria-label="Chart type selector">
              {chartOptions.map((option) => (
                <button
                  className={`segment-button ${chartType === option.value ? "segment-button-active" : ""}`}
                  disabled={!isReady}
                  key={option.value}
                  onClick={() => setChartType(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {aggregation === "count" ? (
          <p className="hint-text">Count uses only the X column and ignores the Y column.</p>
        ) : null}
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">3. Result</span>
            <h2>View the output</h2>
          </div>
          {isReady ? <span className="status-chip">{chartType.toUpperCase()}</span> : null}
        </div>

        {!isReady ? (
          <div className="placeholder">
            <p>Upload a CSV to unlock the chart preview.</p>
          </div>
        ) : (
          <>
            <p className="result-kicker">
              Showing <strong>{chartOptionLabel}</strong> for <strong>{xColumn || "Category"}</strong>
              {aggregation === "count" ? (
                <> grouped by row count.</>
              ) : (
                <>
                  {" "}
                  against <strong>{yColumn || "Value"}</strong> using{" "}
                  <strong>{aggregation}</strong>.
                </>
              )}
            </p>
            <ChartDisplay
              chartType={chartType}
              data={aggregatedData}
              valueLabel={getValueLabel(aggregation, yColumn)}
              xLabel={xColumn || "Category"}
            />
          </>
        )}
      </section>
    </main>
  );
}
