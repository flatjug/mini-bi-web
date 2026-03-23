"use client";

import type { ChangeEvent } from "react";
import { useEffect, useState } from "react";
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

type SavedView = {
  id: string;
  name: string;
  fileName: string;
  rows: CsvRow[];
  columns: string[];
  xColumn: string;
  yColumn: string;
  aggregation: AggregationType;
  chartType: ChartType;
  updatedAt: string;
};

const SAVED_VIEWS_KEY = "pocket-bi.saved-views";
const SESSION_VIEW_KEY = "pocket-bi.session-view";

function isSavedView(value: unknown): value is SavedView {
  if (!value || typeof value !== "object") {
    return false;
  }

  const view = value as Partial<SavedView>;

  return (
    typeof view.id === "string" &&
    typeof view.name === "string" &&
    typeof view.fileName === "string" &&
    Array.isArray(view.rows) &&
    Array.isArray(view.columns) &&
    typeof view.xColumn === "string" &&
    typeof view.yColumn === "string" &&
    typeof view.aggregation === "string" &&
    typeof view.chartType === "string" &&
    typeof view.updatedAt === "string"
  );
}

function loadStoredViews(storageKey: string) {
  if (typeof window === "undefined") {
    return [] as SavedView[];
  }

  try {
    const raw = window.localStorage.getItem(storageKey);

    if (!raw) {
      return [] as SavedView[];
    }

    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [] as SavedView[];
    }

    return parsed.filter(isSavedView);
  } catch {
    return [] as SavedView[];
  }
}

function loadStoredSession() {
  if (typeof window === "undefined") {
    return null as SavedView | null;
  }

  try {
    const raw = window.localStorage.getItem(SESSION_VIEW_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;
    return isSavedView(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

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
  const [viewName, setViewName] = useState("");
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  const aggregatedData = aggregateData(rows, {
    aggregation,
    xColumn,
    yColumn,
  });

  const isReady = columns.length > 0;
  const chartOptionLabel =
    chartOptions.find((option) => option.value === chartType)?.label ?? chartType;

  useEffect(() => {
    const nextSavedViews = loadStoredViews(SAVED_VIEWS_KEY);
    const sessionView = loadStoredSession();

    setSavedViews(nextSavedViews);

    if (sessionView) {
      setRows(sessionView.rows);
      setColumns(sessionView.columns);
      setFileName(sessionView.fileName);
      setXColumn(sessionView.xColumn);
      setYColumn(sessionView.yColumn);
      setAggregation(sessionView.aggregation);
      setChartType(sessionView.chartType);
      setParseMessage(`前回の作業内容「${sessionView.name}」を復元しました。`);
      setViewName(sessionView.name);
    }

    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated || !isReady || typeof window === "undefined") {
      return;
    }

    const sessionView: SavedView = {
      id: "session",
      name: viewName.trim() || "前回の作業",
      fileName,
      rows,
      columns,
      xColumn,
      yColumn,
      aggregation,
      chartType,
      updatedAt: new Date().toISOString(),
    };

    window.localStorage.setItem(SESSION_VIEW_KEY, JSON.stringify(sessionView));
  }, [aggregation, chartType, columns, fileName, isHydrated, isReady, rows, viewName, xColumn, yColumn]);

  useEffect(() => {
    if (!isHydrated || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(savedViews));
  }, [isHydrated, savedViews]);

  const applyView = (view: SavedView) => {
    setRows(view.rows);
    setColumns(view.columns);
    setFileName(view.fileName);
    setXColumn(view.xColumn);
    setYColumn(view.yColumn);
    setAggregation(view.aggregation);
    setChartType(view.chartType);
    setViewName(view.name);
    setParseMessage(`保存済みビュー「${view.name}」を読み込みました。`);
  };

  const handleSaveView = () => {
    const trimmedName = viewName.trim();

    if (!isReady || !trimmedName) {
      return;
    }

    const nextView: SavedView = {
      id: trimmedName,
      name: trimmedName,
      fileName,
      rows,
      columns,
      xColumn,
      yColumn,
      aggregation,
      chartType,
      updatedAt: new Date().toISOString(),
    };

    setSavedViews((currentViews) => {
      const remainingViews = currentViews.filter((view) => view.id !== nextView.id);
      return [nextView, ...remainingViews].sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
      );
    });
    setSaveMessage(`ビュー「${trimmedName}」を保存しました。`);
  };

  const handleDeleteView = (viewId: string) => {
    setSavedViews((currentViews) => currentViews.filter((view) => view.id !== viewId));
    setSaveMessage("保存済みビューを削除しました。");
  };

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
        setSaveMessage(null);

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
            <span className="eyebrow">3. 保存</span>
            <h2>ビューを保存する</h2>
          </div>
          <span className="status-chip">{savedViews.length.toLocaleString()} 件</span>
        </div>

        <div className="save-view-grid">
          <label className="control">
            <span>ビュー名</span>
            <input
              className="text-input"
              disabled={!isReady}
              onChange={(event) => setViewName(event.target.value)}
              placeholder="例: 売上サマリー"
              type="text"
              value={viewName}
            />
          </label>

          <button
            className="primary-action"
            disabled={!isReady || !viewName.trim()}
            onClick={handleSaveView}
            type="button"
          >
            現在のビューを保存
          </button>
        </div>

        <p className="supporting-text">
          保存したビューはこのブラウザ内だけに保持されます。次回アクセス時は前回の作業内容も自動復元されます。
        </p>

        <p className="message">{saveMessage ?? "ビュー名を付けると、現在のCSVと表示設定を保存できます。"}</p>

        {savedViews.length === 0 ? (
          <div className="placeholder compact-placeholder">
            <p>まだ保存済みビューはありません。</p>
          </div>
        ) : (
          <div className="saved-view-list">
            {savedViews.map((view) => (
              <article className="saved-view-card" key={view.id}>
                <div className="saved-view-copy">
                  <strong>{view.name}</strong>
                  <span>{view.fileName || "ファイル名なし"}</span>
                  <span>
                    {view.columns.length.toLocaleString()} カラム ・ {view.rows.length.toLocaleString()} 行
                  </span>
                </div>
                <div className="saved-view-actions">
                  <button
                    className="secondary-action"
                    onClick={() => applyView(view)}
                    type="button"
                  >
                    読み込む
                  </button>
                  <button
                    className="ghost-action"
                    onClick={() => handleDeleteView(view.id)}
                    type="button"
                  >
                    削除
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">4. 結果</span>
            <h2>表示結果</h2>
          </div>
          {isReady ? <span className="status-chip">{chartOptionLabel}</span> : null}
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
              xLabel={xColumn || "カテゴリ"}
            />
          </>
        )}
      </section>
    </main>
  );
}
