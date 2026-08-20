import { Router } from "express";
import { requireOwnerAuth } from "../middleware/authMiddleware";
import {
  getGuildMembers,
  getGuildMember,
  updateMemberNickname,
  updateMemberRoles,
  addRoleToMember,
  removeRoleFromMember,
  timeoutMember,
  kickMember,
  banMember,
  unbanMember,
  getGuildBans,
  sendMemberDM,
  manageMemberVoice,
  executeBulkMemberAction,
} from "../services/memberService";

const router = Router();

router.use(requireOwnerAuth);

// Get members list with optional query and role filter
router.get("/:id/members", async (req, res) => {
  try {
    const members = await getGuildMembers(req.params.id, {
      query: req.query.q as string,
      roleId: req.query.roleId as string,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 1000,
    });
    res.json(members);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single member
router.get("/:id/members/:memberId", async (req, res) => {
  try {
    const member = await getGuildMember(req.params.id, req.params.memberId);
    res.json(member);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update member nickname
router.patch("/:id/members/:memberId/nickname", async (req, res) => {
  try {
    const member = await updateMemberNickname(req.params.id, req.params.memberId, req.body.nickname);
    res.json(member);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Set member roles (replace full set)
router.put("/:id/members/:memberId/roles", async (req, res) => {
  try {
    const member = await updateMemberRoles(req.params.id, req.params.memberId, req.body.roleIds || []);
    res.json(member);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Add single role to member
router.post("/:id/members/:memberId/roles/:roleId", async (req, res) => {
  try {
    const member = await addRoleToMember(req.params.id, req.params.memberId, req.params.roleId);
    res.json(member);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Remove single role from member
router.delete("/:id/members/:memberId/roles/:roleId", async (req, res) => {
  try {
    const member = await removeRoleFromMember(req.params.id, req.params.memberId, req.params.roleId);
    res.json(member);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Apply or remove timeout / mute
router.post("/:id/members/:memberId/timeout", async (req, res) => {
  try {
    const durationMinutes = req.body.durationMinutes !== undefined ? Number(req.body.durationMinutes) : 0;
    const member = await timeoutMember(req.params.id, req.params.memberId, durationMinutes, req.body.reason);
    res.json(member);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Kick member
router.post("/:id/members/:memberId/kick", async (req, res) => {
  try {
    const result = await kickMember(req.params.id, req.params.memberId, req.body.reason);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Ban member
router.post("/:id/members/:memberId/ban", async (req, res) => {
  try {
    const deleteMessageSeconds = req.body.deleteMessageSeconds ? Number(req.body.deleteMessageSeconds) : 0;
    const result = await banMember(req.params.id, req.params.memberId, deleteMessageSeconds, req.body.reason);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Send DM to member
router.post("/:id/members/:memberId/dm", async (req, res) => {
  try {
    if (!req.body.message || !req.body.message.trim()) {
      return res.status(400).json({ error: "Nachricht darf nicht leer sein." });
    }
    const result = await sendMemberDM(req.params.id, req.params.memberId, req.body.message);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Voice moderation (disconnect, mute, unmute, deaf, undeaf, move)
router.post("/:id/members/:memberId/voice", async (req, res) => {
  try {
    const member = await manageMemberVoice(
      req.params.id,
      req.params.memberId,
      req.body.action,
      req.body.targetChannelId
    );
    res.json(member);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get guild bans list
router.get("/:id/bans", async (req, res) => {
  try {
    const bans = await getGuildBans(req.params.id);
    res.json(bans);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Unban user
router.post("/:id/bans/:userId/unban", async (req, res) => {
  try {
    const result = await unbanMember(req.params.id, req.params.userId, req.body.reason);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk member actions
router.post("/:id/members/bulk", async (req, res) => {
  try {
    const result = await executeBulkMemberAction(req.params.id, req.body);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
