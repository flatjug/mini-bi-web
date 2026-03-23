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
      <p>グラフ表示を準備しています...</p>
    </div>
  ),
});

const aggregationOptions: Array<{ label: string; value: AggregationType }> = [
  { label: "件数", value: "count" },
  { label: "合計", value: "sum" },
  { label: "平均", value: "avg" },
];

const chartOptions: Array<{ label: string; value: ChartType }> = [
  { label: "棒グラフ", value: "bar" },
  { label: "折れ線", value: "line" },
  { label: "円グラフ", value: "pie" },
  { label: "表", value: "table" },
];

function getValueLabel(aggregation: AggregationType, yColumn: string) {
  if (aggregation === "count") {
    return "件数";
  }

  if (!yColumn) {
    return "値";
  }

  return `${yColumn}の${aggregationOptions.find((option) => option.value === aggregation)?.label ?? aggregation}`;
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
          setParseMessage(`一部の行を読み飛ばしました: ${results.errors[0]?.message ?? "不明な解析エラー"}`);
          return;
        }

        setParseMessage(`${file.name} を読み込みました。${nextRows.length.toLocaleString()} 行のデータを利用できます。`);
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
            <h1>CSVを読み込んで、その場で見える。</h1>
            <p className="hero-copy">
              CSVをアップロードし、見たいカラムと表示方法を選ぶだけで、グラフや表を1画面で確認できます。
            </p>
            <div className="privacy-note">
              <strong>プライバシー:</strong> CSVはこのブラウザ内だけで処理され、このアプリからアップロードされません。
            </div>
          </div>

          <div className="hero-stats">
            <div className="stat-card">
              <span>行数</span>
              <strong>{rows.length.toLocaleString()}</strong>
            </div>
            <div className="stat-card">
              <span>カラム数</span>
              <strong>{columns.length.toLocaleString()}</strong>
            </div>
            <div className="stat-card stat-card-wide">
              <span>現在の表示</span>
              <strong>{isReady ? chartOptionLabel : "CSV待機中"}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">1. アップロード</span>
            <h2>CSVファイルを選ぶ</h2>
          </div>
          {fileName ? <span className="status-chip">{fileName}</span> : null}
        </div>

        <label className="file-picker">
          <span className="file-picker-title">CSVファイルを選択</span>
          <span className="file-picker-caption">
            「ファイル」から選択できます。ヘッダ行は必須です。
          </span>
          <input accept=".csv,text/csv" onChange={handleFileChange} type="file" />
        </label>

        <div className="micro-stats">
          <div className="micro-stat">
            <span>処理場所</span>
            <strong>この端末内のみ</strong>
          </div>
          <div className="micro-stat">
            <span>保存方法</span>
            <strong>メモリ上のみ</strong>
          </div>
          <div className="micro-stat">
            <span>表示準備</span>
            <strong>{isReady ? "完了" : "未読込"}</strong>
          </div>
        </div>

        <p className={`message ${parseMessage?.startsWith("CSVの読み込みに失敗") ? "message-error" : ""}`}>
          {parseMessage ?? "まだファイルは選択されていません。"}
        </p>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">2. 設定</span>
            <h2>カラムと表示方法を選ぶ</h2>
          </div>
          {rows.length > 0 ? (
            <span className="status-chip">{rows.length.toLocaleString()} 行</span>
          ) : null}
        </div>

        <div className="controls-grid">
          <label className="control">
            <span>X軸カラム</span>
            <select
              disabled={!isReady}
              onChange={(event) => setXColumn(event.target.value)}
              value={xColumn}
            >
              <option value="">カラムを選択</option>
              {columns.map((column) => (
                <option key={column} value={column}>
                  {column}
                </option>
              ))}
            </select>
          </label>

          <label className="control">
            <span>Y軸カラム</span>
            <select
              disabled={!isReady}
              onChange={(event) => setYColumn(event.target.value)}
              value={yColumn}
            >
              <option value="">カラムを選択</option>
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
            <span className="toggle-label">集計方法</span>
            <div className="segmented-control" aria-label="集計方法">
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
            <span className="toggle-label">表示形式</span>
            <div className="segmented-control" aria-label="表示形式">
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
          <p className="hint-text">件数ではX軸カラムのみを使い、Y軸カラムは集計に使いません。</p>
        ) : null}
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">3. 結果</span>
            <h2>表示結果</h2>
          </div>
          {isReady ? <span className="status-chip">{chartType.toUpperCase()}</span> : null}
        </div>

        {!isReady ? (
          <div className="placeholder">
            <p>CSVをアップロードすると、ここにグラフや表が表示されます。</p>
          </div>
        ) : (
          <>
            <p className="result-kicker">
              <strong>{xColumn || "カテゴリ"}</strong> を軸に、<strong>{chartOptionLabel}</strong> で表示しています。
              {aggregation === "count" ? (
                <> 件数ベースで集計しています。</>
              ) : (
                <>
                  {" "}
                  <strong>{yColumn || "値"}</strong> を <strong>{aggregationOptions.find((option) => option.value === aggregation)?.label ?? aggregation}</strong> で集計しています。
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
