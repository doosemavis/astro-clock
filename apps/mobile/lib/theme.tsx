import { createContext, useContext } from "react";
import { NIGHT } from "@astro/engine";
import type { Palette } from "@astro/engine";

/** The current theme: the day/night blend value `t` (0 = night, 1 = day) and the palette
 *  blended to it. Provided by App; read by the wheel layers and all chrome. */
export interface Theme {
  t: number;
  palette: Palette;
}

// Default = full night (today's look), so any consumer rendered without a provider — or
// before App mounts one — looks exactly as it did pre-theming.
const ThemeContext = createContext<Theme>({ t: 0, palette: NIGHT });

export const ThemeProvider = ThemeContext.Provider;
export const useTheme = (): Theme => useContext(ThemeContext);
