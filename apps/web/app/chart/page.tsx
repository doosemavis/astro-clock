// The living chart route — the interactive wheel ported from prototype/index.html.
// Engine supplies all astronomy/geometry/color/data; paid views will gate via
// entitlements() (lib/subscription) in a later phase.
import "./chart.css";
import "./aria-picker.css";
import Chart from "@/components/Chart/Chart";

export default function ChartPage() {
  return <Chart />;
}
