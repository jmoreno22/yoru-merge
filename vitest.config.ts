import { defineConfig } from 'vitest/config';

/**
 * Unit tests for pure TypeScript only — helpers, parsers, validators.
 *
 * Angular components are not compiled here: there is no Angular Vite plugin in
 * the toolchain, and the component contracts are covered by `ng build` with
 * `strictTemplates`. Keep specs free of `@angular/core` imports.
 *
 * The default environment is `node` because booting jsdom costs ~20 s. A spec
 * that genuinely needs DOM globals (localStorage, matchMedia) opts in with a
 * first-line docblock:
 *
 *     // @vitest-environment jsdom
 */
export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
    globals: false,
    reporters: 'dot',
  },
});
