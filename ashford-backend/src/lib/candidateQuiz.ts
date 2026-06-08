export interface QuizQuestion {
  id: number;
  prompt: string;
  options: string[];
  correctIndex: number;
  source: string;
}

export const CANDIDATE_QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    prompt:
      "What is Ashford Creative's flagship product and price point for mental-health practitioners in Texas?",
    options: [
      "A one-time $2,499 custom website build",
      "A $199/month managed website subscription",
      "A free website with ad placements",
      "A $99/month directory listing",
    ],
    correctIndex: 1,
    source: "Company Overview",
  },
  {
    id: 2,
    prompt:
      "Where do sales reps get their leads from?",
    options: [
      "Reps must source their own leads through cold outreach",
      "Reps buy leads from a third-party data broker",
      "Every lead in the dashboard is sourced for them; their job is to work the queue",
      "Leads only come in through the public contact form",
    ],
    correctIndex: 2,
    source: "KB Hub intro / Company Overview",
  },
  {
    id: 3,
    prompt:
      "What does a rep earn for each closed deal under the standard comp plan?",
    options: [
      "$100 closing bonus + $15/month residual per active subscription",
      "$149 closing bonus + the first month's add-on revenue",
      "10% commission on the first month only, plus a $50 close bonus",
      "Hourly only — bonuses are paid quarterly based on team performance",
    ],
    correctIndex: 1,
    source: "Payment Plans & Earnings",
  },
  {
    id: 4,
    prompt:
      "When a prospect says \"I already have a website,\" what is the recommended approach from the Play Cards / Call Scripts?",
    options: [
      "End the call politely and move on",
      "Acknowledge it, then pivot to what their current site is missing (booking, SEO, mobile, ADA) and offer to send a free preview",
      "Tell them their current site is bad and they need to switch immediately",
      "Offer them a 50% discount on the spot",
    ],
    correctIndex: 1,
    source: "Play Cards / Call Scripts",
  },
  {
    id: 5,
    prompt:
      "What is the fastest, lowest-friction way to advance a warm prospect toward a close?",
    options: [
      "Mail them a printed brochure",
      "Schedule a 60-minute discovery meeting next week",
      "Generate and send a personalized preview link by SMS and email so they can see their own site live",
      "Wait for them to call back on their own",
    ],
    correctIndex: 2,
    source: "Reference Guide / Play Cards",
  },
];

export const TOTAL_QUESTIONS = CANDIDATE_QUIZ_QUESTIONS.length;

export interface PublicQuizQuestion {
  id: number;
  prompt: string;
  options: string[];
  source: string;
}

export function publicQuestions(): PublicQuizQuestion[] {
  return CANDIDATE_QUIZ_QUESTIONS.map(({ id, prompt, options, source }) => ({
    id,
    prompt,
    options,
    source,
  }));
}

export function gradeAnswers(answers: number[]): number {
  let score = 0;
  for (let i = 0; i < CANDIDATE_QUIZ_QUESTIONS.length; i++) {
    if (answers[i] === CANDIDATE_QUIZ_QUESTIONS[i].correctIndex) score++;
  }
  return score;
}
