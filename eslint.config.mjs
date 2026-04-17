import globals from "globals";
import tseslint from "typescript-eslint";
import eslint from "@eslint/js";

export default tseslint.config(
  {
    ignores: ["dist/"],
  },

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
  },

  // Configuration for client-side JavaScript files
  {
    files: ["src/public/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.browser, // Use standard Browser global variables
        io: "readonly", // Specific global for Socket.io
      },
    },
    rules: {
      // Overrides for browser JS if needed
    },
  }
);