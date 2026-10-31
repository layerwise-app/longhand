import { defineConfig } from 'vitest/config';

// Unit tests cover the pure logic. They run in Node without the Worker bindings.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: { include: ['src/**/*.test.ts'], environment: 'node' }
});
