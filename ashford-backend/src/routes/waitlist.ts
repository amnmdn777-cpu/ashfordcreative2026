import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const { email, firstName, source } = req.body;
    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Valid email required" });
    }
    await db.execute(sql`
      INSERT INTO waitlist (email, first_name, source, created_at)
      VALUES (${email}, ${firstName ?? null}, ${source ?? "portal"}, NOW())
      ON CONFLICT (email) DO NOTHING
    `);
    res.json({ success: true });
  } catch (err) {
    console.error("waitlist error", err);
    res.status(500).json({ error: "Failed to join waitlist" });
  }
});

export default router;
