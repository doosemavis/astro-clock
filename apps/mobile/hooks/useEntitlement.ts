import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getCustomerInfoSafe, onCustomerInfo } from "../lib/purchases";
import { isProFromCustomerInfo } from "../lib/rcEntitlement";

/** isPro for the current session, sourced from RevenueCat CustomerInfo (instant, offline-cached).
 *  Free when signed out. Re-evaluates when the user changes and on every CustomerInfo update. */
export function useEntitlement(session: Session | null): { isPro: boolean } {
  const [isPro, setIsPro] = useState(false);
  useEffect(() => {
    if (!session) { setIsPro(false); return; }
    setIsPro(false); // reset while the new user's entitlement loads
    let active = true;
    getCustomerInfoSafe().then((info) => { if (active) setIsPro(isProFromCustomerInfo(info)); });
    const unsubscribe = onCustomerInfo((info) => { if (active) setIsPro(isProFromCustomerInfo(info)); });
    return () => { active = false; unsubscribe(); };
  }, [session?.user?.id]);
  return { isPro };
}
