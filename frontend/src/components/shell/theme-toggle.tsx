import type { ButtonDropdownProps } from "@cloudscape-design/components/button-dropdown";
import type { UseThemeResult } from "@/hooks/use-theme";

export const MODE_LIGHT = "mode-light";
export const MODE_DARK = "mode-dark";
export const DENSITY_COMFORTABLE = "density-comfortable";
export const DENSITY_COMPACT = "density-compact";

const THEME_ITEM_IDS = new Set([MODE_LIGHT, MODE_DARK, DENSITY_COMFORTABLE, DENSITY_COMPACT]);

// The real console has no persistent top-level "Theme" nav item -- dark mode lives
// inside the account/settings menu. This builds a nested group for the identity
// utility's dropdown (`TopNavigation.utilities[].items`) instead of its own utility.
export function buildThemeMenuGroup(theme: UseThemeResult): ButtonDropdownProps.ItemGroup {
  return {
    id: "theme",
    text: "Theme",
    items: [
      { id: MODE_LIGHT, text: "Light", itemType: "checkbox", checked: theme.mode === "light" },
      { id: MODE_DARK, text: "Dark", itemType: "checkbox", checked: theme.mode === "dark" },
      {
        id: DENSITY_COMFORTABLE,
        text: "Comfortable density",
        itemType: "checkbox",
        checked: theme.density === "comfortable",
      },
      {
        id: DENSITY_COMPACT,
        text: "Compact density",
        itemType: "checkbox",
        checked: theme.density === "compact",
      },
    ],
  };
}

// Returns true when it handled the click (a theme item), false otherwise -- lets the
// caller's onItemClick fall through to its own ids (e.g. "sign-out") unmodified.
export function handleThemeMenuItemClick(theme: UseThemeResult, id: string): boolean {
  if (!THEME_ITEM_IDS.has(id)) return false;
  switch (id) {
    case MODE_LIGHT:
      theme.setMode("light");
      break;
    case MODE_DARK:
      theme.setMode("dark");
      break;
    case DENSITY_COMFORTABLE:
      theme.setDensity("comfortable");
      break;
    case DENSITY_COMPACT:
      theme.setDensity("compact");
      break;
  }
  return true;
}
