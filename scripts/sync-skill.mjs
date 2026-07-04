#!/usr/bin/env node
// Sincroniza a skill canônica (skills/ziint/) para dentro do plugin
// (plugins/ziint/skills/ziint/), mantendo as duas cópias idênticas.
//
// A skill vive em skills/ziint/ para a instalação universal (`npx skills add`);
// o plugin Claude Code precisa de uma cópia própria em plugins/ziint/skills/ziint/.
// Rodar este script sempre que a skill canônica mudar.
//
// Uso: node scripts/sync-skill.mjs   (a partir da raiz do repo ziint-skills)

import { cp, rm, mkdir, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(root, 'skills/ziint');
const dest = resolve(root, 'plugins/ziint/skills/ziint');

try {
  await access(src);
} catch {
  console.error(`✗ Skill canônica não encontrada em ${src}`);
  process.exit(1);
}

await rm(dest, { recursive: true, force: true });
await mkdir(dirname(dest), { recursive: true });
await cp(src, dest, { recursive: true });

console.log(`✓ Skill sincronizada: skills/ziint/ → plugins/ziint/skills/ziint/`);
