"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { type AggregatedDatum, type ChartType } from "../lib/aggregate";

type ChartDisplayProps = {
  chartType: ChartType;
  data: AggregatedDatum[];
  valueLabel: string;
  xLabel: string;
};

const PIE_COLORS = ["#c96b16", "#f0a74d", "#f6c98b", "#9f4c18", "#e7b46d", "#734321"];

function formatValue(value: number) {
  return Number.isInteger(value)
    ? value.toLocaleString()
    : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function EmptyState() {
  return (
    <div className="placeholder">
      <p>表示できる集計結果がありません。別のカラムや集計方法を試してください。</p>
    </div>
  );
}

function DataTable({ data, valueLabel, xLabel }: Omit<ChartDisplayProps, "chartType">) {
  return (
    <div className="table-wrap">
      <table className="table-view">
        <thead>
          <tr>
            <th>{xLabel}</th>
            <th>{valueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.label}>
              <td>{item.label}</td>
              <td>{formatValue(item.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ChartDisplay({
  chartType,
  data,
  valueLabel,
  xLabel,
}: ChartDisplayProps) {
  if (data.length === 0) {
    return <EmptyState />;
  }

  const chartNode =
    chartType === "bar" ? (
      <BarChart data={data} margin={{ top: 12, right: 12, left: -20, bottom: 16 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8dfd4" />
        <XAxis dataKey="label" interval={0} tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip formatter={(value: number | string) => formatValue(Number(value))} />
        <Bar dataKey="value" fill="#c96b16" radius={[10, 10, 0, 0]} />
      </BarChart>
    ) : chartType === "line" ? (
      <LineChart data={data} margin={{ top: 12, right: 12, left: -20, bottom: 16 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8dfd4" />
        <XAxis dataKey="label" interval={0} tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip formatter={(value: number | string) => formatValue(Number(value))} />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#9f4c18"
          strokeWidth={3}
          dot={{ fill: "#c96b16", r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    ) : (
      <PieChart margin={{ top: 12, right: 12, left: 12, bottom: 12 }}>
        <Tooltip formatter={(value: number | string) => formatValue(Number(value))} />
        <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: "12px" }} />
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          innerRadius={48}
          outerRadius={108}
          paddingAngle={3}
        >
          {data.map((item, index) => (
            <Cell key={`${item.label}-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
          ))}
        </Pie>
      </PieChart>
    );

  return (
    <div className="chart-card">
      <div className="chart-header">
        <span>{xLabel}</span>
        <span>
          {data.length.toLocaleString()} グループ ・ {valueLabel}
        </span>
      </div>

      {chartType === "table" ? (
        <DataTable data={data} valueLabel={valueLabel} xLabel={xLabel} />
      ) : (
        <div className="chart-frame">
          <ResponsiveContainer width="100%" height="100%">
            {chartNode}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
