import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

function run(args: string[], env: NodeJS.ProcessEnv) {
  const result = spawnSync(process.execPath, args, { env, stdio: "inherit" });
  if (result.error) throw result.error;
  assert.equal(result.status, 0);
}

async function exercise(phase: string) {
  if (phase === "before-restart") {
    const prisma = new PrismaClient();
    try {
      const migration = readFileSync(
        join(__dirname, "../prisma/migrations/20261114000000_relay_count/migration.sql"), "utf8",
      );
      for (const statement of migration.split(";").map((part) => part.trim()).filter(Boolean)) {
        await prisma.$executeRawUnsafe(statement);
      }
    } finally {
      await prisma.$disconnect();
    }
  }

  const { getCountingStats, processCountingMessage, resetCountingRun, setCountingChannel } =
    await import("../src/backend/services/countingService");
  const guildId = "guild";
  const post = (messageId: string, playerId: string, content: string, channelId = "counting") =>
    processCountingMessage({ guildId, channelId, messageId, playerId, content });

  if (phase === "before-restart") {
    await setCountingChannel(guildId, "counting");
    for (const content of ["", "0", "-1", "+1", "1.0", "1 2", "1e0", "one"]) {
      assert.equal(await post(`invalid-${content}`, "a", content), null);
    }
    assert.equal(await post("off-channel", "a", "1", "general"), null);
    assert.equal((await post("first", "a", " 1 "))?.outcome, "valid");
    assert.equal((await post("double", "a", "2"))?.outcome, "reset");
    assert.equal(await post("first", "a", "1"), null);

    const players = ["a", "b", "a", "c", "d", "e", "f"];
    const results = await Promise.all(players.map((player, index) =>
      post(`relay-${index}`, player, String(index + 1))));
    assert.deepEqual(results.map((result) => result?.outcome),
      ["valid", "valid", "valid", "valid", "valid", "earned", "valid"]);
    assert.deepEqual(await getCountingStats(guildId), {
      channelId: "counting", nextNumber: "8", record: "7", saveStatus: "charged", relayProgress: 5,
    });
    await setCountingChannel(guildId, "new-channel");
    assert.equal(await post("old-channel", "g", "8"), null);
    assert.equal((await getCountingStats("other-guild")).channelId, null);
    return;
  }

  assert.deepEqual(await getCountingStats(guildId), {
    channelId: "new-channel", nextNumber: "8", record: "7", saveStatus: "charged", relayProgress: 5,
  });
  assert.equal(await post("relay-6", "f", "7", "new-channel"), null);
  const saved = await Promise.all([
    post("saved", "f", "8", "new-channel"),
    post("saved", "f", "8", "new-channel"),
  ]);
  assert.deepEqual(saved, [{ outcome: "saved", nextNumber: "8" }, null]);
  assert.equal((await getCountingStats(guildId)).saveStatus, "used");
  assert.equal((await post("still-double", "f", "8", "new-channel"))?.outcome, "reset");
  assert.equal((await getCountingStats(guildId)).record, "7");

  const secondRun = await Promise.all(["a", "b", "c", "d", "e"].map((player, index) =>
    post(`again-${index}`, player, String(index + 1), "new-channel")));
  assert.equal(secondRun[4]?.outcome, "earned");
  assert.equal((await post("wrong-number", "f", "999", "new-channel"))?.outcome, "saved");
  const thirdRun = await Promise.all(["f", "g", "h", "i", "j"].map((player, index) =>
    post(`used-${index}`, player, String(index + 6), "new-channel")));
  assert.ok(thirdRun.every((result) => result?.outcome === "valid"));
  assert.ok(await resetCountingRun(guildId));
  assert.deepEqual(await getCountingStats(guildId), {
    channelId: "new-channel", nextNumber: "1", record: "10", saveStatus: "available", relayProgress: 0,
  });
  assert.equal(await post("used-0", "f", "6", "new-channel"), null);
}

const phase = process.argv[2];
if (phase) {
  exercise(phase).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
} else {
  const directory = mkdtempSync(join(tmpdir(), "guildpilot-counting-"));
  const env = { ...process.env, DATABASE_URL: `file:${join(directory, "test.db").replace(/\\/g, "/")}` };
  try {
    for (const phase of ["before-restart", "after-restart"]) {
      run(["--import", "tsx", __filename, phase], env);
    }
    console.log("Relay Count integration checks passed.");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
