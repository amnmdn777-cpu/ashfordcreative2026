import { logger } from "../lib/logger";

/**
 * LOT 3.B4 — Concierge telehealth_full onboarding task surface.
 *
 * When a Concierge subscription starts, ops needs a checklist of
 * white-glove steps to execute (Doxy.me Pro account creation, BAA
 * signature walk-through, 30-min onboarding video session). This stub
 * generates the task list; the admin UI for actioning it is a follow-up.
 *
 * TODO(concierge-telehealth-tasks):
 *   - Persist tasks to a DB table `concierge_telehealth_tasks`
 *   - Surface in SubscriptionsPage detail as a checklist
 *   - Email ops when a Concierge sub triggers task creation
 */

export type ConciergeTelehealthTask = {
  id: string;
  subscriptionId: number;
  step: string;
  done: boolean;
  createdAtIso: string;
};

const DEFAULT_STEPS = [
  "Doxy.me Pro account provisioned under brand",
  "Branded waiting room (logo, colors, hold message) configured",
  "BAA signed by client (walk-through in <2 min)",
  "30-min onboarding video session scheduled",
  "/visit page wired to new Doxy room URL",
  "Single monthly invoice rolled into Stripe sub",
];

const inMemoryTasks = new Map<number, ConciergeTelehealthTask[]>();

export function createConciergeTelehealthTasks(subId: number): ConciergeTelehealthTask[] {
  const tasks: ConciergeTelehealthTask[] = DEFAULT_STEPS.map((step, i) => ({
    id: `ctt_${subId}_${i}`,
    subscriptionId: subId,
    step,
    done: false,
    createdAtIso: new Date().toISOString(),
  }));
  inMemoryTasks.set(subId, tasks);
  logger.info({ subId, count: tasks.length }, "[concierge-telehealth] tasks created (stub)");
  return tasks;
}

export function listConciergeTelehealthTasks(subId: number): ConciergeTelehealthTask[] {
  return inMemoryTasks.get(subId) ?? [];
}
