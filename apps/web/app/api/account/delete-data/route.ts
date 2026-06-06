import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Always take the id from the server-session user — never from request body.
  const userId = user.id;

  const admin = createServiceClient();

  const { error: chartsError } = await admin
    .from("birth_charts")
    .delete()
    .eq("user_id", userId);

  if (chartsError) {
    console.error("[account/delete-data] Failed to delete birth_charts:", userId, chartsError.message);
    return new Response("Delete failed", { status: 500 });
  }

  const { error: profileError } = await admin
    .from("profiles")
    .delete()
    .eq("id", userId);

  if (profileError) {
    console.error("[account/delete-data] Failed to delete profile:", userId, profileError.message);
    return new Response("Delete failed", { status: 500 });
  }

  // Subscriptions are intentionally NOT deleted — the auth account remains active.

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
