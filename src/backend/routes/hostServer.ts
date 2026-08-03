import { Router } from "express";
import { collectHostMetrics } from "../services/hostMonitorService";

const router = Router();

router.get("/metrics", async (req, res) => {
  try {
    const metrics = await collectHostMetrics();
    res.json(metrics);
  } catch (err) {
    res.status(500).json({ error: "Failed to collect host metrics" });
  }
});

export default router;
