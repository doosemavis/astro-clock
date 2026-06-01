import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import "../login/auth.css";

export default async function AccountPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account");

  const { data: profile } = await supabase
    .from("profiles").select("display_name").eq("id", user.id).maybeSingle();

  return (
    <div className="auth-root">
      <div className="auth-card">
        <h1 className="auth-title">Account</h1>
        <div className="auth-field"><span>Email</span><div className="auth-static">{user.email}</div></div>
        {profile?.display_name && (
          <div className="auth-field"><span>Name</span><div className="auth-static">{profile.display_name}</div></div>
        )}
        <form action="/auth/signout" method="post">
          <button type="submit" className="auth-submit">Sign out</button>
        </form>
        <a className="auth-toggle" href="/chart">← Back to your chart</a>
      </div>
    </div>
  );
}
