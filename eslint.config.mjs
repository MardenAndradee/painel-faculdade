import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/coverage/**',
      '**/*.config.{js,mjs,cjs}',
      'apps/web/next-env.d.ts',
      // Client do Prisma: codigo gerado, nao versionado e fora do nosso padrao.
      'apps/api/src/generated/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    rules: {
      // A proibicao de `any` e um requisito do projeto, entao e erro e nao aviso.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },

  // Backend: Node puro, sem DOM.
  {
    files: ['apps/api/**/*.ts'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        __dirname: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        URL: 'readonly',
        fetch: 'readonly',
      },
    },
  },

  // O logger e o bootstrap do servidor sao os unicos pontos que escrevem no stdout.
  {
    files: ['apps/api/src/config/logger.ts', 'apps/api/src/server.ts', 'apps/api/prisma/seed.ts'],
    rules: { 'no-console': 'off' },
  },

  // Frontend: regras dos Hooks do React. Dependencias erradas em useEffect
  // produzem bugs de estado que nenhum outro lint pega.
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        fetch: 'readonly',
        Headers: 'readonly',
        FormData: 'readonly',
        URL: 'readonly',
        Response: 'readonly',
        RequestInit: 'readonly',
        console: 'readonly',
        process: 'readonly',
      },
    },
  },

  prettier,
);
