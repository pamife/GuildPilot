import { Router } from "express";
import { requireOwnerAuth } from "../middleware/authMiddleware";
import {
  saveServerTemplate,
  getTemplates,
  deleteTemplate,
  applyTemplate,
  duplicateChannel,
  duplicateCategory,
} from "../services/templateService";

const router = Router();

router.use(requireOwnerAuth);

router.get("/", async (req, res) => {
  try {
    const templates = await getTemplates();
    res.json(templates);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/guilds/:id/save", async (req, res) => {
  try {
    const { name, description } = req.body;
    const template = await saveServerTemplate(req.params.id, name, description);
    res.json(template);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/:templateId", async (req, res) => {
  try {
    const result = await deleteTemplate(req.params.templateId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/guilds/:id/apply/:templateId", async (req, res) => {
  try {
    const result = await applyTemplate(req.params.id, req.params.templateId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/guilds/:id/duplicate-channel", async (req, res) => {
  try {
    const { channelId } = req.body;
    const result = await duplicateChannel(req.params.id, channelId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/guilds/:id/duplicate-category", async (req, res) => {
  try {
    const { categoryId } = req.body;
    const result = await duplicateCategory(req.params.id, categoryId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
