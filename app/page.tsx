"use client";

import type { ChangeEvent } from "react";
import { useEffect, useRef, useState } from "react";
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
    <div className="placeholder workspace-placeholder">
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

const sampleCsv = `region,month,sales,orders
Tokyo,Jan,120000,42
Tokyo,Feb,98000,36
Tokyo,Mar,143000,51
Osaka,Jan,87000,31
Osaka,Feb,91000,34
Osaka,Mar,109000,38
Nagoya,Jan,76000,28
Nagoya,Feb,83000,29
Nagoya,Mar,92000,33`;

type MenuTab = "file" | "settings" | "save";

type SavedView = {
  id: string;
  name: string;
  fileName: string;
  rows: CsvRow[];
  columns: string[];
  xColumn: string;
  yColumn: string;
  aggregation: AggregationType;
  chartLayout: [ChartType, ChartType, ChartType];
  updatedAt: string;
};

const DEFAULT_CHART_LAYOUT: [ChartType, ChartType, ChartType] = ["bar", "line", "pie"];
const SAVED_VIEWS_KEY = "pocket-bi.saved-views";
const SESSION_VIEW_KEY = "pocket-bi.session-view";

function isChartType(value: unknown): value is ChartType {
  return value === "bar" || value === "line" || value === "pie" || value === "table";
}

function normalizeStoredView(value: unknown) {
  if (!value || typeof value !== "object") {
    return null as SavedView | null;
  }

  const view = value as Partial<SavedView> & { chartType?: unknown };
  const chartLayout =
    Array.isArray(view.chartLayout) &&
    view.chartLayout.length === 3 &&
    view.chartLayout.every(isChartType)
      ? (view.chartLayout as [ChartType, ChartType, ChartType])
      : isChartType(view.chartType)
        ? ([view.chartType, "line", "pie"] as [ChartType, ChartType, ChartType])
        : null;

  if (
    typeof view.id !== "string" ||
    typeof view.name !== "string" ||
    typeof view.fileName !== "string" ||
    !Array.isArray(view.rows) ||
    !Array.isArray(view.columns) ||
    typeof view.xColumn !== "string" ||
    typeof view.yColumn !== "string" ||
    typeof view.aggregation !== "string" ||
    typeof view.updatedAt !== "string" ||
    !chartLayout
  ) {
    return null;
  }

  return {
    id: view.id,
    name: view.name,
    fileName: view.fileName,
    rows: view.rows,
    columns: view.columns,
    xColumn: view.xColumn,
    yColumn: view.yColumn,
    aggregation: view.aggregation as AggregationType,
    chartLayout,
    updatedAt: view.updatedAt,
  };
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

    return parsed.map(normalizeStoredView).filter((view): view is SavedView => view !== null);
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

    return normalizeStoredView(JSON.parse(raw));
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

function getChartOptionLabel(chartType: ChartType) {
  return chartOptions.find((option) => option.value === chartType)?.label ?? chartType;
}

function formatTimestamp(isoString: string) {
  try {
    return new Intl.DateTimeFormat("ja-JP", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(isoString));
  } catch {
    return isoString;
  }
}

export default function HomePage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<CsvRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [parseMessage, setParseMessage] = useState<string | null>(null);
  const [xColumn, setXColumn] = useState("");
  const [yColumn, setYColumn] = useState("");
  const [aggregation, setAggregation] = useState<AggregationType>("count");
  const [chartLayout, setChartLayout] = useState<[ChartType, ChartType, ChartType]>(
    DEFAULT_CHART_LAYOUT,
  );
  const [viewName, setViewName] = useState("");
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<MenuTab | null>("file");
  const [isHydrated, setIsHydrated] = useState(false);

  const aggregatedData = aggregateData(rows, {
    aggregation,
    xColumn,
    yColumn,
  });

  const isReady = columns.length > 0;
  const namedViewExists = savedViews.some((view) => view.id === viewName.trim());

  useEffect(() => {
    const nextSavedViews = loadStoredViews(SAVED_VIEWS_KEY);
    const sessionView = loadStoredSession();

    setSavedViews(nextSavedViews);

    if (sessionView) {
      applyViewState(sessionView, true);
      setActiveMenu(null);
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
      chartLayout,
      updatedAt: new Date().toISOString(),
    };

    window.localStorage.setItem(SESSION_VIEW_KEY, JSON.stringify(sessionView));
  }, [
    aggregation,
    chartLayout,
    columns,
    fileName,
    isHydrated,
    isReady,
    rows,
    viewName,
    xColumn,
    yColumn,
  ]);

  useEffect(() => {
    if (!isHydrated || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(savedViews));
  }, [isHydrated, savedViews]);

  function applyViewState(view: SavedView, isSessionRestore = false) {
    setRows(view.rows);
    setColumns(view.columns);
    setFileName(view.fileName);
    setXColumn(view.xColumn);
    setYColumn(view.yColumn);
    setAggregation(view.aggregation);
    setChartLayout(view.chartLayout);
    setViewName(view.name);
    setParseMessage(
      isSessionRestore
        ? `前回の作業内容「${view.name}」を復元しました。`
        : `保存済みビュー「${view.name}」を読み込みました。`,
    );
  }

  function loadCsvRows(nextRows: CsvRow[], nextFileName: string, nextMessage: string) {
    const nextColumns = extractColumns(nextRows);
    const nextXColumn = nextColumns[0] ?? "";
    const nextYColumn = nextColumns[1] ?? nextColumns[0] ?? "";

    if (nextRows.length === 0 || nextColumns.length === 0) {
      setRows([]);
      setColumns([]);
      setFileName(nextFileName);
      setXColumn("");
      setYColumn("");
      setParseMessage("CSVから読み取れる行がありませんでした。ヘッダ付きのCSVを選んでください。");
      return;
    }

    setRows(nextRows);
    setColumns(nextColumns);
    setFileName(nextFileName);
    setXColumn(nextXColumn);
    setYColumn(nextYColumn);
    setAggregation("count");
    setChartLayout(DEFAULT_CHART_LAYOUT);
    setSaveMessage(null);
    setParseMessage(nextMessage);
    setActiveMenu(null);
  }

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

        if (results.errors.length > 0) {
          loadCsvRows(
            nextRows,
            file.name,
            `一部の行を読み飛ばしました: ${results.errors[0]?.message ?? "不明な解析エラー"}`,
          );
          return;
        }

        loadCsvRows(
          nextRows,
          file.name,
          `${file.name} を読み込みました。${nextRows.length.toLocaleString()} 行のデータを利用できます。`,
        );
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

  const loadSampleData = () => {
    Papa.parse<Record<string, unknown>>(sampleCsv, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const nextRows = normalizeCsvRows(results.data);
        loadCsvRows(nextRows, "sample-sales.csv", "サンプルデータを読み込みました。");
        setViewName("サンプルビュー");
      },
    });
  };

  const applyView = (view: SavedView) => {
    applyViewState(view, false);
    setActiveMenu(null);
  };

  const persistView = (mode: "saveAs" | "overwrite") => {
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
      chartLayout,
      updatedAt: new Date().toISOString(),
    };

    setSavedViews((currentViews) => {
      const remainingViews =
        mode === "overwrite"
          ? currentViews.filter((view) => view.id !== nextView.id)
          : currentViews.filter((view) => view.id !== nextView.id);

      return [nextView, ...remainingViews].sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
      );
    });

    setSaveMessage(
      mode === "overwrite"
        ? `ビュー「${trimmedName}」を上書き保存しました。`
        : `ビュー「${trimmedName}」を保存しました。`,
    );
  };

  const handleDeleteView = (viewId: string) => {
    setSavedViews((currentViews) => currentViews.filter((view) => view.id !== viewId));
    setSaveMessage("保存済みビューを削除しました。");
  };

  const updateChartSlot = (slotIndex: number, nextType: ChartType) => {
    setChartLayout((currentLayout) => {
      const nextLayout = [...currentLayout] as [ChartType, ChartType, ChartType];
      nextLayout[slotIndex] = nextType;
      return nextLayout;
    });
  };

  const toggleMenu = (menu: MenuTab) => {
    setActiveMenu((currentMenu) => (currentMenu === menu ? null : menu));
  };

  const recentViews = savedViews.slice(0, 4);

  return (
    <main className="app-frame">
      <input
        accept=".csv,text/csv"
        className="sr-only"
        onChange={handleFileChange}
        ref={fileInputRef}
        type="file"
      />

      <header className="menu-bar">
        <div className="menu-brand">
          <span className="menu-brand-mark">Pocket BI</span>
          <strong>{fileName || "Untitled View"}</strong>
        </div>

        <div className="menu-actions">
          <button
            className={`menu-button ${activeMenu === "file" ? "menu-button-active" : ""}`}
            onClick={() => toggleMenu("file")}
            type="button"
          >
            ファイル
          </button>
          <button
            className={`menu-button ${activeMenu === "settings" ? "menu-button-active" : ""}`}
            onClick={() => toggleMenu("settings")}
            type="button"
          >
            表示
          </button>
          <button
            className={`menu-button ${activeMenu === "save" ? "menu-button-active" : ""}`}
            onClick={() => toggleMenu("save")}
            type="button"
          >
            保存
          </button>
        </div>

        <div className="menu-summary">
          <span>{rows.length.toLocaleString()} 行</span>
          <span>{columns.length.toLocaleString()} カラム</span>
        </div>
      </header>

      <section className="status-bar">
        <span>{parseMessage ?? "ファイルを読み込むと3つのグラフビューが表示されます。"}</span>
      </section>

      <section className="context-strip">
        <span className="context-pill">
          <strong>保存先:</strong> この端末のこのブラウザ
        </span>
        <span className="context-pill">
          <strong>X:</strong> {xColumn || "未選択"}
        </span>
        <span className="context-pill">
          <strong>Y:</strong> {aggregation === "count" ? "未使用" : yColumn || "未選択"}
        </span>
        <span className="context-pill">
          <strong>集計:</strong> {aggregationOptions.find((option) => option.value === aggregation)?.label}
        </span>
      </section>

      {activeMenu ? (
        <section className="menu-panel compact-menu-panel">
          {activeMenu === "file" ? (
            <div className="menu-popover-grid">
              <div className="menu-popover-card">
                <span className="eyebrow">File</span>
                <h2>ファイル</h2>
                <button
                  className="primary-action"
                  onClick={() => fileInputRef.current?.click()}
                  type="button"
                >
                  CSVを開く
                </button>
                <button className="secondary-action" onClick={loadSampleData} type="button">
                  サンプルを試す
                </button>
              </div>

              <div className="menu-popover-card">
                <span className="eyebrow">Recent</span>
                <h2>最近のビュー</h2>
                {recentViews.length === 0 ? (
                  <p className="popover-empty">まだ保存済みビューはありません。</p>
                ) : (
                  <div className="mini-list">
                    {recentViews.map((view) => (
                      <button
                        className="mini-list-item"
                        key={view.id}
                        onClick={() => applyView(view)}
                        type="button"
                      >
                        <strong>{view.name}</strong>
                        <span>{formatTimestamp(view.updatedAt)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {activeMenu === "settings" ? (
            <div className="menu-panel-stack">
              <div className="settings-grid">
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

              <div className="settings-grid">
                {chartLayout.map((slotType, index) => (
                  <label className="control" key={`${slotType}-${index}`}>
                    <span>グラフ {index + 1}</span>
                    <select
                      disabled={!isReady}
                      onChange={(event) => updateChartSlot(index, event.target.value as ChartType)}
                      value={slotType}
                    >
                      {chartOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          {activeMenu === "save" ? (
            <div className="menu-panel-stack">
              <div className="save-view-grid">
                <label className="control">
                  <span>ビュー名</span>
                  <input
                    className="text-input"
                    disabled={!isReady}
                    onChange={(event) => setViewName(event.target.value)}
                    placeholder="例: 売上ダッシュボード"
                    type="text"
                    value={viewName}
                  />
                </label>

                <div className="save-actions">
                  <button
                    className="primary-action"
                    disabled={!isReady || !viewName.trim()}
                    onClick={() => persistView("saveAs")}
                    type="button"
                  >
                    名前を付けて保存
                  </button>
                  <button
                    className="secondary-action"
                    disabled={!isReady || !viewName.trim() || !namedViewExists}
                    onClick={() => persistView("overwrite")}
                    type="button"
                  >
                    上書き保存
                  </button>
                </div>
              </div>

              <p className="message">
                {saveMessage ?? "保存したビューは、このブラウザだけで保持されます。"}
              </p>

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
                          {formatTimestamp(view.updatedAt)} ・ {view.columns.length.toLocaleString()} カラム
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
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="workspace">
        {!isReady ? (
          <div className="workspace-empty">
            <div className="workspace-empty-copy">
              <span className="eyebrow">Workspace</span>
              <h1>3つのグラフビューで見比べる</h1>
              <p>
                上の「ファイル」からCSVを開くかサンプルを試すと、同じ集計条件で3つのグラフを並べて比較できます。
              </p>
            </div>
          </div>
        ) : (
          <div className="chart-grid">
            {chartLayout.map((chartType, index) => (
              <section className="chart-window" key={`${chartType}-${index}`}>
                <div className="chart-window-bar">
                  <div>
                    <span>グラフ {index + 1}</span>
                    <strong>{getChartOptionLabel(chartType)}</strong>
                  </div>
                  <span className="chart-window-meta">
                    {xColumn || "カテゴリ"} /{" "}
                    {aggregationOptions.find((option) => option.value === aggregation)?.label}
                  </span>
                </div>
                <ChartDisplay
                  chartType={chartType}
                  data={aggregatedData}
                  valueLabel={getValueLabel(aggregation, yColumn)}
                  xLabel={xColumn || "カテゴリ"}
                />
              </section>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
