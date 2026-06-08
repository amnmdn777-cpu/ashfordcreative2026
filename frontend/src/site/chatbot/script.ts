import type { StringKey } from "../lib/strings";

export type Reply = {
  label: StringKey;
  /** If set, this reply navigates to the route (and closes the chat). */
  link?: string;
  /** If set (and no link), advances to the named script node. */
  goto?: string;
};

export type Node =
  | {
      kind: "message";
      id: string;
      bot: StringKey;
      replies: Reply[];
    }
  | {
      kind: "form";
      id: string;
      bot: StringKey;
    }
  | {
      /**
       * Live domain availability picker rendered inline in the chat.
       * The widget delegates to the shared <DomainPicker /> component so
       * the offer cards match the public hero / portal exactly.
       */
      kind: "domain";
      id: string;
      bot: StringKey;
      replies: Reply[];
    };

export const SCRIPT: Record<string, Node> = {
  start: {
    kind: "message",
    id: "start",
    bot: "cb_greeting",
    replies: [
      { label: "cb_q_see", goto: "see" },
      { label: "cb_q_cost", goto: "cost" },
      { label: "cb_q_fast", goto: "fast" },
      { label: "cb_q_domain", goto: "domain_intro" },
      { label: "cb_q_human", goto: "form" },
    ],
  },
  see: {
    kind: "message",
    id: "see",
    bot: "cb_see_bot",
    replies: [
      { label: "cb_open_templates", link: "/templates" },
      { label: "cb_see_call", goto: "form" },
      { label: "cb_back", goto: "start" },
    ],
  },
  cost: {
    kind: "message",
    id: "cost",
    bot: "cb_cost_bot",
    replies: [
      { label: "cb_open_pricing", link: "/pricing" },
      { label: "cb_cost_addons", goto: "addons" },
      { label: "cb_cost_call", goto: "form" },
      { label: "cb_back", goto: "start" },
    ],
  },
  addons: {
    kind: "message",
    id: "addons",
    bot: "cb_addons_bot",
    replies: [
      { label: "cb_open_pricing", link: "/pricing" },
      { label: "cb_addons_call", goto: "form" },
      { label: "cb_back", goto: "start" },
    ],
  },
  fast: {
    kind: "message",
    id: "fast",
    bot: "cb_fast_bot",
    replies: [
      { label: "cb_open_how", link: "/how-it-works" },
      { label: "cb_fast_call", goto: "form" },
      { label: "cb_back", goto: "start" },
    ],
  },
  domain_intro: {
    kind: "message",
    id: "domain_intro",
    bot: "cb_domain_bot",
    replies: [
      { label: "cb_domain_check", goto: "domain_check" },
      { label: "cb_domain_skip", goto: "start" },
    ],
  },
  domain_check: {
    kind: "domain",
    id: "domain_check",
    bot: "cb_domain_prompt",
    replies: [
      { label: "cb_domain_results_call", goto: "form" },
      { label: "cb_back", goto: "start" },
    ],
  },
  form: {
    kind: "form",
    id: "form",
    bot: "cb_form_title",
  },
};
