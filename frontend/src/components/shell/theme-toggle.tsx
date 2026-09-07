import type { TopNavigationProps } from "@cloudscape-design/components/top-navigation";
import type { UseThemeResult } from "@/hooks/use-theme";

const MODE_LIGHT = "mode-light";
const MODE_DARK = "mode-dark";
const DENSITY_COMFORTABLE = "density-comfortable";
const DENSITY_COMPACT = "density-compact";

// Dark/light + density only this phase; visual-refresh is a Phase 7 deliverable
// per docs/ROADMAP.md even though docs/UI-PARITY.md §5 describes them together.
export function buildThemeUtility(theme: UseThemeResult): TopNavigationProps.MenuDropdownUtility {
  return {
    type: "menu-dropdown",
    text: "Theme",
    ariaLabel: "Theme settings",
    iconName: "settings",
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
    onItemClick: ({ detail }) => {
      switch (detail.id) {
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
    },
  };
}
