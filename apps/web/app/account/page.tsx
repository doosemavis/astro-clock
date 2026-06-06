import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPrimaryBirthChart } from "@/lib/birthCharts";
import { DEFAULT_BIRTH, birthInstant, positions, ascendant, signOf } from "@astro/engine";
import "../login/auth.css";

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account");

  const { data: profile } = await supabase
    .from("profiles").select("display_name").eq("id", user.id).maybeSingle();

  // The same "big three" (Sun · Moon · Ascendant) shown under the name on the chart panel.
  const birth = (await getPrimaryBirthChart(supabase)) ?? DEFAULT_BIRTH;
  const date = birthInstant(birth);
  const np = positions(date);
  const asc = ascendant(date, birth.lat, birth.lon);
  const signs = `☉ ${signOf(np.sun)}  ·  ☽ ${signOf(np.moon)}  ·  ↑ ${signOf(asc)}`;

  return (
    <div className="auth-root">
      <div className="auth-card">
        <div className="account-head">
          <h1 className="auth-title">Account</h1>
          <form action="/auth/signout" method="post">
            <button type="submit" className="account-signout">Sign out</button>
          </form>
        </div>
        <div className="auth-field"><span>Email</span><div className="auth-static">{user.email}</div></div>
        {profile?.display_name && (
          <div className="auth-field"><span>Name</span><div className="auth-static">{profile.display_name}</div></div>
        )}
        <div className="auth-field"><span>Sign</span><div className="auth-static">{signs}</div></div>
        <a className="auth-toggle" href="/chart">← Back to your chart</a>
      </div>
    </div>
  );
}
