// The living chart route — the interactive wheel ported from prototype/index.html.
// Engine supplies all astronomy/geometry/color/data; paid views will gate via
// entitlements() (lib/subscription) in a later phase. Logged-in users load their saved
// primary birth chart server-side; anonymous users fall back to localStorage in <Chart>.
import "./chart.css";
import "./aria-picker.css";
import Chart from "@/components/Chart/Chart";
import { createClient } from "@/lib/supabase/server";
import { getPrimaryBirthChart } from "@/lib/birthCharts";

export default async function ChartPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const initialBirth = user ? await getPrimaryBirthChart(supabase) : null;
  const userName =
    (user?.user_metadata?.name as string | undefined) ??
    (user?.user_metadata?.full_name as string | undefined) ??
    null;
  return (
    <Chart
      userId={user?.id ?? null}
      userEmail={user?.email ?? null}
      userName={userName}
      initialBirth={initialBirth}
    />
  );
}
