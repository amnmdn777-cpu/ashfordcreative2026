import { Router, type IRouter } from "express";
import { db, candidateQuizSubmissions } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAdmin, requireAuth } from "../../middleware/requireAuth";
import { notFound } from "../../lib/errors";
import { dateToIso } from "../../lib/serialize";
import { CANDIDATE_QUIZ_QUESTIONS } from "../../lib/candidateQuiz";

const router: IRouter = Router();
router.use("/admin", requireAuth, requireAdmin);

router.get(
  "/admin/candidates",
  asyncHandler(async (_req, res) => {
    const rows = await db
      .select()
      .from(candidateQuizSubmissions)
      .orderBy(desc(candidateQuizSubmissions.submittedAt));
    res.json({
      submissions: rows.map((r) => ({
        id: r.id,
        name: r.name,
        score: r.score,
        totalQuestions: r.totalQuestions,
        submittedAt: dateToIso(r.submittedAt),
        startedAt: dateToIso(r.startedAt),
      })),
    });
  }),
);

router.get(
  "/admin/candidates/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw notFound("Submission not found");
    const [row] = await db
      .select()
      .from(candidateQuizSubmissions)
      .where(eq(candidateQuizSubmissions.id, id))
      .limit(1);
    if (!row) throw notFound("Submission not found");
    res.json({
      id: row.id,
      name: row.name,
      score: row.score,
      totalQuestions: row.totalQuestions,
      startedAt: dateToIso(row.startedAt),
      submittedAt: dateToIso(row.submittedAt),
      answers: row.answers,
      readingTrail: row.readingTrail,
      questions: CANDIDATE_QUIZ_QUESTIONS.map((q) => ({
        id: q.id,
        prompt: q.prompt,
        options: q.options,
        correctIndex: q.correctIndex,
        source: q.source,
      })),
    });
  }),
);

router.delete(
  "/admin/candidates/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw notFound("Submission not found");
    const deleted = await db
      .delete(candidateQuizSubmissions)
      .where(eq(candidateQuizSubmissions.id, id))
      .returning({ id: candidateQuizSubmissions.id });
    if (deleted.length === 0) throw notFound("Submission not found");
    res.json({ ok: true });
  }),
);

export default router;
