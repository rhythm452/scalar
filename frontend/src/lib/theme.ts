import { applyDensity, applyMode, Density, Mode } from "@cloudscape-design/global-styles";
import { THEME_DENSITY_COOKIE_NAME, THEME_MODE_COOKIE_NAME } from "@/lib/constants";

export type ThemeModeValue = "light" | "dark";
export type ThemeDensityValue = "comfortable" | "compact";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  const value = match?.[1];
  return value !== undefined ? decodeURIComponent(value) : null;
}

function writeCookie(name: string, value: string): void {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
}

export function getStoredMode(): ThemeModeValue {
  const stored = readCookie(THEME_MODE_COOKIE_NAME) ?? window.localStorage.getItem(THEME_MODE_COOKIE_NAME);
  return stored === "dark" ? "dark" : "light";
}

export function getStoredDensity(): ThemeDensityValue {
  const stored =
    readCookie(THEME_DENSITY_COOKIE_NAME) ?? window.localStorage.getItem(THEME_DENSITY_COOKIE_NAME);
  return stored === "compact" ? "compact" : "comfortable";
}

export function setStoredMode(mode: ThemeModeValue): void {
  applyMode(mode === "dark" ? Mode.Dark : Mode.Light);
  writeCookie(THEME_MODE_COOKIE_NAME, mode);
  window.localStorage.setItem(THEME_MODE_COOKIE_NAME, mode);
}

export function setStoredDensity(density: ThemeDensityValue): void {
  applyDensity(density === "compact" ? Density.Compact : Density.Comfortable);
  writeCookie(THEME_DENSITY_COOKIE_NAME, density);
  window.localStorage.setItem(THEME_DENSITY_COOKIE_NAME, density);
}

// Runs synchronously as the first child of <body>, before hydration, to avoid a
// flash of the wrong theme. Cannot `import` @cloudscape-design/global-styles here
// (it isn't loaded yet), so the class names it applies (`awsui-dark-mode`,
// `awsui-compact-mode`) are hardcoded literals matching applyMode/applyDensity's
// real behavior, confirmed by reading the installed package's source directly.
// Cookie names must match THEME_MODE_COOKIE_NAME / THEME_DENSITY_COOKIE_NAME above.
export const THEME_INIT_SCRIPT = `(function () {
  try {
    var cookies = document.cookie.split("; ").reduce(function (acc, part) {
      var idx = part.indexOf("=");
      if (idx > -1) acc[part.slice(0, idx)] = decodeURIComponent(part.slice(idx + 1));
      return acc;
    }, {});
    var mode = cookies["${THEME_MODE_COOKIE_NAME}"] || window.window.localStorage.getItem("${THEME_MODE_COOKIE_NAME}");
    var density = cookies["${THEME_DENSITY_COOKIE_NAME}"] || window.window.localStorage.getItem("${THEME_DENSITY_COOKIE_NAME}");
    if (mode === "dark") document.body.classList.add("awsui-dark-mode");
    if (density === "compact") document.body.classList.add("awsui-compact-mode");
  } catch (e) {}
})();`;
