// Only processes files that `@import "tailwindcss"` — currently just
// src/app/marketing/marketing.css. Cloudscape's CSS never passes through
// this plugin, so this has no effect on the console routes.
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
