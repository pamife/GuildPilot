import { Router } from "express";
import { requireOwnerAuth } from "../middleware/authMiddleware";
import { getGuildInvites, createInvite, deleteInvite } from "../services/inviteService";

const router = Router();

router.use(requireOwnerAuth);

router.get("/:id/invites", async (req, res) => {
  try {
    const invites = await getGuildInvites(req.params.id);
    res.json(invites);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/:id/invites", async (req, res) => {
  try {
    const invite = await createInvite(req.params.id, req.body);
    res.json(invite);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/:id/invites/:code", async (req, res) => {
  try {
    const result = await deleteInvite(req.params.id, req.params.code);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
