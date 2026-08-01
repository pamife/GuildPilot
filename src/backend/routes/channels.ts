import { Router } from "express";
import { requireOwnerAuth } from "../middleware/authMiddleware";
import { getGuildChannels, createChannel, updateChannel, deleteChannel } from "../services/channelService";

const router = Router();

router.use(requireOwnerAuth);

router.get("/:id/channels", async (req, res) => {
  try {
    const channels = await getGuildChannels(req.params.id);
    res.json(channels);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/:id/channels", async (req, res) => {
  try {
    const channel = await createChannel(req.params.id, req.body);
    res.json(channel);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/:id/channels/:channelId", async (req, res) => {
  try {
    const channel = await updateChannel(req.params.id, req.params.channelId, req.body);
    res.json(channel);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/:id/channels/:channelId", async (req, res) => {
  try {
    const result = await deleteChannel(req.params.id, req.params.channelId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
