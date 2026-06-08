import { pgTable, serial, varchar, integer, jsonb, timestamp, index } from "drizzle-orm/pg-core";

export const candidateQuizSubmissions = pgTable(
  "candidate_quiz_submissions",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 128 }).notNull(),
    score: integer("score").notNull(),
    totalQuestions: integer("total_questions").notNull(),
    answers: jsonb("answers").$type<number[]>().notNull(),
    readingTrail: jsonb("reading_trail").$type<{
      totalKbMs: number;
      sections: Array<{
        key: string;
        title: string;
        msSpent: number;
        firstOpenedAt: string;
      }>;
      firstOpenedAt: string | null;
      lastSeenAt: string | null;
      quizOpenedAt: string | null;
    }>(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    submittedAtIdx: index("candidate_quiz_submitted_at_idx").on(t.submittedAt),
  }),
);

export type CandidateQuizSubmission = typeof candidateQuizSubmissions.$inferSelect;
export type InsertCandidateQuizSubmission = typeof candidateQuizSubmissions.$inferInsert;
