import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/account"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // If Supabase isn't configured (env vars unset in this deploy), skip the session refresh
  // instead of constructing a client with undefined values and throwing — that surfaces as
  // MIDDLEWARE_INVOCATION_FAILED (a 500 on every route). Degrade gracefully: public pages
  // keep serving; auth-gated routes simply won't have a session.
  if (!supabaseUrl || !supabaseKey) return response;

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() validates with Supabase — required; do NOT use getSession() for auth checks.
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  if (!user && PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return response;
}
