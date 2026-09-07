"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getStoredDensity,
  getStoredMode,
  setStoredDensity,
  setStoredMode,
  type ThemeDensityValue,
  type ThemeModeValue,
} from "@/lib/theme";

export interface UseThemeResult {
  mode: ThemeModeValue | null;
  density: ThemeDensityValue | null;
  setMode: (mode: ThemeModeValue) => void;
  setDensity: (density: ThemeDensityValue) => void;
}

// State starts unset (not read from `document` during render -- `document` doesn't
// exist during the SSR pass). The no-flash guarantee comes entirely from the
// blocking script in layout.tsx (src/lib/theme.ts THEME_INIT_SCRIPT); this hook only
// needs to be right for the toggle control's checked state after mount.
export function useTheme(): UseThemeResult {
  const [mode, setModeState] = useState<ThemeModeValue | null>(null);
  const [density, setDensityState] = useState<ThemeDensityValue | null>(null);

  useEffect(() => {
    setModeState(getStoredMode());
    setDensityState(getStoredDensity());
  }, []);

  const setMode = useCallback((next: ThemeModeValue) => {
    setStoredMode(next);
    setModeState(next);
  }, []);

  const setDensity = useCallback((next: ThemeDensityValue) => {
    setStoredDensity(next);
    setDensityState(next);
  }, []);

  return { mode, density, setMode, setDensity };
}
