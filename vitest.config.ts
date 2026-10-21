import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['apps/**/*.test.ts', 'tests/unit/**/*.test.ts'], environment: 'node' } });
