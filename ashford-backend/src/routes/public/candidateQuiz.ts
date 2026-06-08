import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, candidateQuizSubmissions } from "@workspace/db";
import { asyncHandler } from "../../middleware/asyncHandler";
import { badRequest } from "../../lib/errors";
import {
  CANDIDATE_QUIZ_QUESTIONS,
  TOTAL_QUESTIONS,
  publicQuestions,
  gradeAnswers,
} from "../../lib/candidateQuiz";

const router: IRouter = Router();

router.get(
  "/public/candidate-quiz/questions",
  asyncHandler(async (_req, res) => {
    res.json({ totalQuestions: TOTAL_QUESTIONS, questions: publicQuestions() });
  }),
);

const ReadingTrailSchema = z.object({
  totalKbMs: z.number().int().min(0).max(24 * 60 * 60 * 1000),
  sections: z
    .array(
      z.object({
        key: z.string().min(1).max(64),
        title: z.string().min(1).max(128),
        msSpent: z.number().int().min(0).max(24 * 60 * 60 * 1000),
        firstOpenedAt: z.string().datetime(),
      }),
    )
    .max(32),
  firstOpenedAt: z.string().datetime().nullable(),
  lastSeenAt: z.string().datetime().nullable(),
  quizOpenedAt: z.string().datetime().nullable(),
});

const SubmitSchema = z.object({
  name: z.string().trim().min(1).max(128),
  answers: z.array(z.number().int().min(0).max(20)).length(TOTAL_QUESTIONS),
  startedAt: z.string().datetime().optional(),
  readingTrail: ReadingTrailSchema.optional(),
});

router.post(
  "/public/candidate-quiz/submissions",
  asyncHandler(async (req, res) => {
    const parsed = SubmitSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest("Invalid submission");
    const { name, answers, startedAt, readingTrail } = parsed.data;
    // Validate every answer index falls within its question's option range.
    for (let i = 0; i < CANDIDATE_QUIZ_QUESTIONS.length; i++) {
      if (answers[i] >= CANDIDATE_QUIZ_QUESTIONS[i].options.length) {
        throw badRequest("Invalid answer index");
      }
    }
    const score = gradeAnswers(answers);
    const [row] = await db
      .insert(candidateQuizSubmissions)
      .values({
        name,
        score,
        totalQuestions: TOTAL_QUESTIONS,
        answers,
        readingTrail: readingTrail ?? null,
        startedAt: startedAt ? new Date(startedAt) : null,
      })
      .returning();
    res.json({ id: row.id, score, totalQuestions: TOTAL_QUESTIONS });
  }),
);

export default router;
