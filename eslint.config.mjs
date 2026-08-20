import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Contenu français : apostrophes typographiques dans le JSX — la règle
      // n'apporte rien ici et casserait la CI sur du texte légitime.
      "react/no-unescaped-entities": "off",
      // Nouvelles règles strictes du React Compiler : à corriger
      // progressivement — en avertissement pour ne pas bloquer les releases.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Sorties générées par la CLI Netlify (jamais éditées à la main)
    ".netlify/**",
  ]),
]);

export default eslintConfig;
