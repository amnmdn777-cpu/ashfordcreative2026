import { createContext, useContext } from "react";

/**
 * Lets Clarity's own header (TopBar) double as the page navigation when
 * it's rendered inside the multi-page wrapper (showcase demo / portal),
 * so we don't stack a second separate "PAGES" bar on top of it.
 *
 * When this context is present, the header shows page links and clicking
 * one switches pages via `navigate`. When absent (a standalone single-page
 * render), the header falls back to in-page section anchors.
 */
export interface ClarityNav {
  activePath: string;
  navigate: (path: string) => void;
}

export const ClarityNavContext = createContext<ClarityNav | null>(null);

export const useClarityNav = (): ClarityNav | null =>
  useContext(ClarityNavContext);
