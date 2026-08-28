import { Router } from "express";
import {
  AuthenticatedRequest,
  requireAuth,
  requireGuildAccess,
} from "../middleware/authMiddleware";
import {
  saveServerTemplate,
  getTemplates,
  deleteTemplate,
  applyTemplate,
  duplicateChannel,
  duplicateCategory,
} from "../services/templateService";

const router = Router();

router.use(requireAuth);

router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const templates = await getTemplates();
    res.json(templates);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/guilds/:id/save", requireGuildAccess("id"), async (req: AuthenticatedRequest, res) => {
  try {
    const { name, description } = req.body;
    const template = await saveServerTemplate(req.params.id, name, description);
    res.json(template);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/:templateId", async (req: AuthenticatedRequest, res) => {
  try {
    const result = await deleteTemplate(req.params.templateId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/guilds/:id/apply/:templateId", requireGuildAccess("id"), async (req: AuthenticatedRequest, res) => {
  try {
    const result = await applyTemplate(req.params.id, req.params.templateId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/guilds/:id/duplicate-channel", requireGuildAccess("id"), async (req: AuthenticatedRequest, res) => {
  try {
    const { channelId } = req.body;
    const result = await duplicateChannel(req.params.id, channelId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/guilds/:id/duplicate-category", requireGuildAccess("id"), async (req: AuthenticatedRequest, res) => {
  try {
    const { categoryId } = req.body;
    const result = await duplicateCategory(req.params.id, categoryId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

