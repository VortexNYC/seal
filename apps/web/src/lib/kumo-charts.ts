import { Chart, TimeseriesChart } from "@cloudflare/kumo/components/chart";
import { BarChart, LineChart, PieChart } from "echarts/charts";
import {
  BrushComponent,
  GridComponent,
  TooltipComponent,
  ToolboxComponent,
} from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  BrushComponent,
  ToolboxComponent,
  CanvasRenderer,
]);

export { Chart, TimeseriesChart, echarts };

/** Read a Seal Kumo token so canvas charts paint with the product palette. */
export function kumoPaint(token: string): string {
  if (typeof document === "undefined") return "transparent";
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(token)
    .trim();
  return value.length > 0 ? value : "transparent";
}
