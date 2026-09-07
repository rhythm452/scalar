import { FlatCompat } from "@eslint/eslintrc";

// eslint-config-next still ships its rules in the legacy (eslintrc) shape;
// FlatCompat is Next.js's own documented bridge for consuming it under
// ESLint 9's flat config.
const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const eslintConfig = [...compat.extends("next/core-web-vitals")];

export default eslintConfig;
