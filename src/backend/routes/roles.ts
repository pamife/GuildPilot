import { Router } from "express";
import { requireOwnerAuth } from "../middleware/authMiddleware";
import { getGuildRoles, createRole, updateRole, reorderRoles, deleteRole } from "../services/roleService";

const router = Router();

router.use(requireOwnerAuth);

router.get("/:id/roles", async (req, res) => {
  try {
    const roles = await getGuildRoles(req.params.id);
    res.json(roles);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/:id/roles", async (req, res) => {
  try {
    const role = await createRole(req.params.id, req.body);
    res.json(role);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/:id/roles/reorder", async (req, res) => {
  try {
    const result = await reorderRoles(req.params.id, req.body.rolePositions);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/:id/roles/:roleId", async (req, res) => {
  try {
    const role = await updateRole(req.params.id, req.params.roleId, req.body);
    res.json(role);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/:id/roles/:roleId", async (req, res) => {
  try {
    const result = await deleteRole(req.params.id, req.params.roleId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
