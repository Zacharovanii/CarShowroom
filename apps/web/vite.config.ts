import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// Пакеты 3D-сцены: three.js, R3F, drei и то, что они тянут за собой.
// Всё это нужно только вкладке «3D», поэтому живёт в отдельном чанке
// и грузится по требованию (D11).
const THREE_PACKAGES = [
  "three",
  "@react-three",
  "three-stdlib",
  "three-mesh-bvh",
  "camera-controls",
  "maath",
  "meshline",
  "troika-[a-z-]+",
  "webgl-sdf-generator",
  "bidi-js",
  "detect-gpu",
  "glsl-noise",
  "stats-gl",
  "stats\\.js",
  "tunnel-rat",
  "potpack",
  "its-fine",
  "suspend-react",
  "zustand",
  "react-use-measure",
  "@use-gesture",
  "@monogrid",
  "@mediapipe",
  "hls\\.js",
].join("|");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    // Стартовые чанки (`react` + `vendor` + код приложения) укладываются
    // в 320 КБ каждый, и порог их сторожит. Перешагивает его только `three`
    // (~1 МБ): это осознанно, он грузится, лишь когда человек открыл вкладку
    // «3D», и на первую отрисовку не влияет — предупреждение о нём было бы
    // шумом, а шум обесценивает и все остальные предупреждения.
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      output: {
        // Три группы вместо одного «всё из node_modules в vendor».
        // Общее правило затащило бы three.js в стартовый бандл, и React.lazy
        // в CarViewer перестал бы что-либо значить: сцену качал бы каждый,
        // кто открыл главную.
        advancedChunks: {
          groups: [
            // React делят между собой и приложение, и сцена. Без явной
            // группы rolldown кладёт его в чанк сцены, стартовый бандл
            // начинает зависеть от three.js, и вся затея рушится —
            // это проверяется по `modulepreload` в собранном index.html.
            {
              name: "react",
              test: /node_modules\/(react|react-dom|scheduler|use-sync-external-store)\//,
              priority: 20,
            },
            { name: "three", test: new RegExp(`node_modules/(${THREE_PACKAGES})/`), priority: 10 },
            // Каркас приложения: роутер, TanStack Query, Better Auth, zod,
            // Radix. Меняется редко, поэтому стоит отдельно от нашего кода.
            { name: "vendor", test: /node_modules\//, priority: 1 },
          ],
        },
      },
    },
  },

  server: {
    port: 5173,
    // Всё, что начинается с /api, уходит в Nest. Это не только удобство:
    // сессия Better Auth — httpOnly cookie, и через прокси фронт и API
    // живут на одном origin, поэтому cookie ходит без CORS и SameSite-плясок.
    proxy: {
      "/api": { target: "http://localhost:3000", changeOrigin: true },
      "/assets": { target: "http://localhost:3000", changeOrigin: true },
    },
  },
});
