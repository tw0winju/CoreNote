import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 개발 중에는 Vite(5173)가 프론트를 서빙하고, /api 요청만 Express 서버(3001)로 프록시합니다.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
