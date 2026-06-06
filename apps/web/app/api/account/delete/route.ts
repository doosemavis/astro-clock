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
  const { error } = await admin.auth.admin.deleteUser(userId);

  if (error) {
    console.error("[account/delete] Failed to delete user:", userId, error.message);
    return new Response("Delete failed", { status: 500 });
  }

  // Clear the session cookies now that the auth identity is gone.
  await supabase.auth.signOut();

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
