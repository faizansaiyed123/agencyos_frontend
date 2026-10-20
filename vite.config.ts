import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The API sets its refresh cookie with SameSite=Strict on /api/v1/auth, so the
// browser must see the API as same-origin. In dev we proxy /api to FastAPI.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": { target: "http://localhost:8001", changeOrigin: false } },
  },
});
