import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const [profileResult, chartsResult, subscriptionsResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("birth_charts").select("*").eq("user_id", user.id),
    supabase.from("subscriptions").select("*").eq("user_id", user.id),
  ]);

  const payload = {
    exported_at: new Date().toISOString(),
    account: {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      providers: (user.app_metadata?.providers as string[] | undefined) ?? [],
    },
    profile: profileResult.data ?? null,
    birth_charts: chartsResult.data ?? [],
    subscriptions: subscriptionsResult.data ?? [],
  };

  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="movestar-data.json"',
    },
  });
}
