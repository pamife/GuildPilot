import { Router } from "express";
import { requireOwnerAuth } from "../middleware/authMiddleware";
import {
  getGuildEmojis,
  createEmoji,
  updateEmoji,
  deleteEmoji,
  getGuildStickers,
  createSticker,
  deleteSticker,
} from "../services/emojiStickerService";

const router = Router();

router.use(requireOwnerAuth);

// Emojis
router.get("/:id/emojis", async (req, res) => {
  try {
    const emojis = await getGuildEmojis(req.params.id);
    res.json(emojis);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/:id/emojis", async (req, res) => {
  try {
    const { name, image } = req.body;
    const emoji = await createEmoji(req.params.id, name, image);
    res.json(emoji);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/:id/emojis/:emojiId", async (req, res) => {
  try {
    const { name } = req.body;
    const emoji = await updateEmoji(req.params.id, req.params.emojiId, name);
    res.json(emoji);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/:id/emojis/:emojiId", async (req, res) => {
  try {
    const result = await deleteEmoji(req.params.id, req.params.emojiId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Stickers
router.get("/:id/stickers", async (req, res) => {
  try {
    const stickers = await getGuildStickers(req.params.id);
    res.json(stickers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/:id/stickers", async (req, res) => {
  try {
    const { name, description, tags, file } = req.body;
    const sticker = await createSticker(req.params.id, name, description, tags, file);
    res.json(sticker);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/:id/stickers/:stickerId", async (req, res) => {
  try {
    const result = await deleteSticker(req.params.id, req.params.stickerId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
