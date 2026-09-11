import { defineConfig } from 'vitest/config';

const ZONE_TESTING = 'zone.js/testing';
const ZONE_TESTING_STUB = '\0yoru:zone-testing';

/**
 * The unit-test builder writes a guarded `import('zone.js/testing')` into its
 * TestBed bootstrap. This app is zoneless, so the guard never fires, but the
 * browser-side resolver still has to resolve the specifier, and zone.js is a
 * transitive package the DOM environment cannot reach — which fails every
 * jsdom spec at transform time. Resolve it to nothing instead.
 */
const stubZoneTesting = {
  name: 'yoru:stub-zone-testing',
  enforce: 'pre',
  resolveId: (id: string) => (id === ZONE_TESTING ? ZONE_TESTING_STUB : null),
  load: (id: string) => (id === ZONE_TESTING_STUB ? 'export {};' : null),
} as const;

/**
 * Runner configuration for `pnpm test` (= `ng test`, the `@angular/build:unit-test`
 * builder). Test discovery lives in the `test` target of `angular.json`; the
 * builder ignores an `include` written here.
 *
 * Two tiers share this runner:
 *
 * - **Pure TypeScript** — helpers, parsers, validators — runs in the `node`
 *   environment, the default below, and imports no framework.
 * - **Component specs** render a component through `TestBed`, may import
 *   `@angular/core`, and opt into the DOM with a first-line docblock:
 *
 *       // @vitest-environment jsdom
 *
 * The DOM environment costs a few seconds of boot per run, which is why `node`
 * stays the default. `src/testing/` holds the stand-ins the DOM lacks.
 */
export default defineConfig({
  plugins: [stubZoneTesting],
  test: {
    environment: 'node',
    globals: false,
    reporters: 'dot',
    /**
     * Spec files run one at a time. Under the default file-level parallelism
     * the component tier is not deterministic: the specs that wait on
     * `afterNextRender`, the CDK portal or the virtual viewport lose their
     * render window when a sibling fork competes for the CPU, and between one
     * and four of them fail at random. Measured on `228ab35` — the tree the
     * round-8 review passed as «831 green» — three parallel runs gave 1 fail,
     * 0 fails, 4 fails; three serial runs gave 831 green each. The cost is
     * about twelve seconds a run, against a gate whose result could not be
     * trusted before (review round 9).
     */
    fileParallelism: false,
  },
});
