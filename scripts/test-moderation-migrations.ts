import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
const latest = '20261115010000_moderation_workspace';
async function verify() {
  const db = new PrismaClient();
  try {
    const settings = await db.moderationSettings.findUniqueOrThrow({ where: { guildId: 'legacy' } });
    assert.equal(settings.reviewRoleIds, '["review-role"]'); assert.equal(settings.timeoutRoleIds, '["timeout-role"]'); assert.equal(settings.logChannelId, 'private-log');
    assert.equal(settings.permissions, '{}'); assert.equal(settings.dmDefault, false);
    const old = await db.moderationCase.findUniqueOrThrow({ where: { guildId_number: { guildId: 'legacy', number: 42 } } });
    assert.equal(old.reason, 'Preserved evidence'); assert.equal(old.sourceId, 'legacy:42'); assert.equal(old.status, 'succeeded');
    assert.equal(old.dmStatus, 'not_requested');
    const { reserveCase, moderationDb } = await import('../src/backend/services/moderationService');
    const next = await reserveCase({ guildId: 'legacy', targetId: 'member', sourceId: 'new:43', action: 'warn', reason: 'New warning' });
    assert.equal(next.record.number, 43); await moderationDb.$disconnect();
    assert.equal((await db.autoModSettings.findUniqueOrThrow({ where: { guildId: 'legacy' } })).rules, '{"legacy":true}');
    assert.deepEqual(await db.$queryRawUnsafe('PRAGMA foreign_key_check'), []);
    console.log('Upgrade preserves existing case numbers, roles, settings, AutoMod rules and evidence.');
  } finally { await db.$disconnect(); }
}
async function main() {
  const dir = mkdtempSync(join(tmpdir(), 'guildpilot-migration-'));
  const database = join(dir, 'upgrade.db'); writeFileSync(database, '');
  const env = { ...process.env, DATABASE_URL: `file:${database.replaceAll('\\', '/')}` };
  const run = (args: string[], input?: string) => { const r = spawnSync(process.execPath, args, { env, input, stdio: input ? ['pipe', 'inherit', 'inherit'] : 'inherit' }); if (r.error) throw r.error; assert.equal(r.status, 0); };
  try {
    cpSync('prisma/schema.prisma', join(dir, 'schema.prisma'));
    mkdirSync(join(dir, 'migrations'));
    for (const entry of readdirSync('prisma/migrations')) if (entry < latest || entry === 'migration_lock.toml') cpSync(join('prisma/migrations', entry), join(dir, 'migrations', entry), { recursive: true });
    run(['node_modules/prisma/build/index.js', 'migrate', 'deploy', '--schema', join(dir, 'schema.prisma')]);
    run(['node_modules/prisma/build/index.js', 'db', 'execute', '--schema', join(dir, 'schema.prisma'), '--stdin'], `
      INSERT INTO ModerationSettings (guildId, logChannelId, reviewRoleIds, timeoutRoleIds) VALUES ('legacy', 'private-log', '["review-role"]', '["timeout-role"]');
      INSERT INTO ModerationCaseSequence (guildId, lastNumber) VALUES ('legacy', 42);
      INSERT INTO ModerationCase (guildId, number, sourceId, targetId, action, reason, status) VALUES ('legacy', 42, 'legacy:42', 'member', 'warn', 'Preserved evidence', 'succeeded');
      INSERT INTO AutoModSettings (guildId, rules) VALUES ('legacy', '{"legacy":true}');
    `);
    // A backup is made before the upgrade, mirroring the production deployment requirement.
    cpSync(database, join(dir, 'before-upgrade.db'));
    run(['node_modules/prisma/build/index.js', 'migrate', 'deploy']);
    run(['node_modules/tsx/dist/cli.mjs', __filename, '--verify']);
    run(['node_modules/prisma/build/index.js', 'migrate', 'diff', '--from-url', env.DATABASE_URL, '--to-schema-datamodel', resolve('prisma/schema.prisma'), '--exit-code']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
(process.argv.includes('--verify') ? verify() : main()).catch(error => { console.error(error); process.exitCode = 1; });
