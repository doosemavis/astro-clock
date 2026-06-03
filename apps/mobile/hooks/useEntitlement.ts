import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { entitlementFromRow } from "../lib/entitlement";

/** Read the signed-in user's subscription row and derive isPro. Defaults Free on error. */
async function fetchIsPro(): Promise<boolean> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("status, current_period_end")
    .maybeSingle();
  if (error) {
    console.warn("entitlement fetch failed (defaulting Free):", error.message);
    return false;
  }
  return entitlementFromRow(data).isPro;
}

/** isPro for the current session; refetches when the user changes, Free when signed out. */
export function useEntitlement(session: Session | null): { isPro: boolean } {
  const [isPro, setIsPro] = useState(false);
  useEffect(() => {
    if (!session) { setIsPro(false); return; }
    setIsPro(false); // reset while the new user's entitlement fetch is in flight
    let active = true;
    fetchIsPro()
      .then((v) => { if (active) setIsPro(v); })
      .catch(() => { if (active) setIsPro(false); });
    return () => { active = false; };
  }, [session?.user?.id]);
  return { isPro };
}
