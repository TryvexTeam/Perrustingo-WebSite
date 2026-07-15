import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      /* Deuda conocida: lecturas de localStorage al montar (hidratación).
         Bajar a error cuando se refactoricen a useSyncExternalStore. */
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "public/sw.js"]),
]);

export default eslintConfig;
