import globals from "globals";
import tseslint from "typescript-eslint";
import eslint from "@eslint/js";

export default tseslint.config(
  // Use ESLint's recommended built-in rules
  eslint.configs.recommended,
  
  // Use TypeScript-ESLint's recommended rules
  ...tseslint.configs.recommended,
  
  // Configuration for all your .ts files
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.node, // Use standard Node.js global variables
      },
    },
    rules: {
      //  Custom rules here, for example:

    },
  }
);