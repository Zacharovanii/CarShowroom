import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**"] },
  ...tseslint.configs.recommended,

  // Правила React — только для фронта: в apps/api и contracts React нет
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    rules: {
      // ТЗ требует чистой консоли. console.error оставлен: он нужен
      // в обработчиках ошибок, и это осознанный вывод, а не забытая отладка.
      "no-console": ["error", { allow: ["error"] }],
      "no-var": "error",
      "prefer-const": "error",
    },
  },
);
