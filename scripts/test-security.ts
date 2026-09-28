import axios from "axios";
import jwt from "jsonwebtoken";

const API_BASE = process.env.API_BASE_URL || "http://127.0.0.1:3001/api";
const JWT_SECRET = process.env.JWT_SECRET || "test";
const OWNER_ID = process.env.ALLOWED_USER_ID || "999888777666555444";
const FAKE_USER_ID = "111222333444555666";

async function waitForServer() {
  console.log(`Warte auf Backend-Verbindung auf ${API_BASE}/health...`);
  for (let i = 0; i < 20; i++) {
    try {
      const res = await axios.get(`${API_BASE}/health`, { timeout: 1000 });
      if (res.status === 200) {
        console.log("✅ Backend Server ist online & erreichbar.\n");
        return true;
      }
    } catch (e) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error("Backend Server konnte nicht innerhalb von 20 Sekunden erreicht werden.");
}

async function runSecurityTests() {
  await waitForServer();

  console.log("\n=======================================================");
  console.log("🛡️  GUILDPILOT MULTI-USER & SECURITY TEST SUITE");
  console.log("=======================================================\n");

  let passed = 0;
  let failed = 0;


  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`❌ [FAIL] ${name}`);
      console.error(`   Error: ${err.message}`);
      failed++;
    }
  }

  // 1. Unauthenticated Checks
  await test("1. Unauthenticated access to /api/guilds returns 401", async () => {
    try {
      await axios.get(`${API_BASE}/guilds`);
      throw new Error("Expected 401 Unauthorized but request succeeded");
    } catch (err: any) {
      if (err.response?.status !== 401) throw new Error(`Expected 401, got ${err.response?.status}`);
    }
  });

  await test("2. Unauthenticated access to /api/host-server/metrics returns 401", async () => {
    try {
      await axios.get(`${API_BASE}/host-server/metrics`);
      throw new Error("Expected 401 Unauthorized but request succeeded");
    } catch (err: any) {
      if (err.response?.status !== 401) throw new Error(`Expected 401, got ${err.response?.status}`);
    }
  });

  await test("3. Unauthenticated access to /api/guilds/123/tickets returns 401", async () => {
    try {
      await axios.get(`${API_BASE}/guilds/123/tickets/stats`);
      throw new Error("Expected 401 Unauthorized but request succeeded");
    } catch (err: any) {
      if (err.response?.status !== 401) throw new Error(`Expected 401, got ${err.response?.status}`);
    }
  });

  // 2. Manipulated / Invalid JWT Token
  await test("4. Manipulated JWT Token returns 401", async () => {
    const forgedToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.fake_signature";
    try {
      await axios.get(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${forgedToken}` },
      });
      throw new Error("Expected 401 with forged token");
    } catch (err: any) {
      if (err.response?.status !== 401) throw new Error(`Expected 401, got ${err.response?.status}`);
    }
  });

  // 3. Regular User Tests
  const userToken = jwt.sign(
    { id: FAKE_USER_ID, username: "RegularUser#1234", avatar: null },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  await test("5. Regular user accessing /api/host-server/metrics returns 403 Forbidden", async () => {
    try {
      await axios.get(`${API_BASE}/host-server/metrics`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      throw new Error("Expected 403 Forbidden for non-owner accessing host telemetry");
    } catch (err: any) {
      if (err.response?.status !== 403) throw new Error(`Expected 403, got ${err.response?.status}`);
    }
  });

  await test("6. Regular user attempting /api/host-server/restart-now returns 403 Forbidden", async () => {
    try {
      await axios.post(`${API_BASE}/host-server/restart-now`, {}, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      throw new Error("Expected 403 Forbidden for non-owner attempting system restart");
    } catch (err: any) {
      if (err.response?.status !== 403) throw new Error(`Expected 403, got ${err.response?.status}`);
    }
  });

  await test("7. Regular user accessing unauthorized /api/guilds/999999/channels returns 403 Forbidden (IDOR Protection)", async () => {
    try {
      await axios.get(`${API_BASE}/guilds/999999999999/channels`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      throw new Error("Expected 403 Forbidden for unauthorized guild access");
    } catch (err: any) {
      if (err.response?.status !== 403 && err.response?.status !== 404) {
        throw new Error(`Expected 403 or 404, got ${err.response?.status}`);
      }
    }
  });

  // 4. Owner Tests (Discord ID from ALLOWED_USER_ID)
  const ownerToken = jwt.sign(
    { id: OWNER_ID, username: "OwnerAccount#0001", avatar: null },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  await test("8. Owner accessing /api/auth/me returns role OWNER and isOwner=true", async () => {
    const res = await axios.get(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    if (res.data.isOwner !== true || res.data.user.role !== "OWNER") {
      throw new Error(`Expected isOwner: true, got ${JSON.stringify(res.data)}`);
    }
  });

  await test("9. Owner accessing /api/host-server/metrics succeeds (200 OK)", async () => {
    const res = await axios.get(`${API_BASE}/host-server/metrics`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    if (res.status !== 200 || typeof res.data !== "object") {
      throw new Error(`Expected 200 OK, got ${res.status}`);
    }
  });

  console.log("\n=======================================================");
  console.log(`TEST RESULT: ${passed} Passed, ${failed} Failed`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityTests().catch((err) => {
  console.error("Test runner fatal error:", err);
  process.exit(1);
});
