import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? sources(join(dir, e.name)) : e.name.endsWith('.ts') ? [join(dir, e.name)] : []);
}
describe('hexagonal dependency direction', () => {
  it('keeps framework and infrastructure dependencies outside the core', () => {
    for (const path of [...sources('apps/api/src/domain'), ...sources('apps/api/src/application')]) {
      const imports = [...readFileSync(path, 'utf8').matchAll(/(?:from\s+|import\s*)['"]([^'"]+)['"]/g)].map(m => m[1]);
      for (const dependency of imports) {
        expect(dependency, `${path} imports ${dependency}`).not.toMatch(/@nestjs|@prisma|socket\.io|adapters|composition/);
      }
    }
  });
});
