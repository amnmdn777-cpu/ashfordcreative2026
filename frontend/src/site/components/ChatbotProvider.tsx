import {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
} from "react";

interface Ctx {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const ChatCtx = createContext<Ctx | null>(null);

export function ChatbotProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const open = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((v) => !v), []);
  // Stable context value: without `useMemo` the provider would mint a
  // fresh `{ isOpen, open, close, toggle }` literal every render and
  // re-render every `useChatbot()` consumer. The launcher button is
  // mounted on every marketing page, so the cost compounds.
  const value = useMemo<Ctx>(
    () => ({ isOpen, open, close, toggle }),
    [isOpen, open, close, toggle],
  );
  return <ChatCtx.Provider value={value}>{children}</ChatCtx.Provider>;
}

// Stable no-op fallback returned when useChatbot is called outside a
// <ChatbotProvider>. Throwing here used to crash the entire marketing
// page if the launcher was ever rendered without the provider (e.g.
// preview routes that mount a template <ThemeProvider> wrapper without
// the full marketing chrome). Gate with a one-shot console.warn in dev
// so the missing provider still gets noticed, and let the click no-op
// instead of taking the user-facing site down with it. (LOT 7.5)
let warned = false;
const NOOP_CTX: Ctx = {
  isOpen: false,
  open: () => {
    if (!warned && import.meta.env.DEV) {
      warned = true;
      // eslint-disable-next-line no-console
      console.warn(
        "[Chatbot] open() called outside <ChatbotProvider>; click is a no-op.",
      );
    }
  },
  close: () => {},
  toggle: () => {},
};

export function useChatbot() {
  const v = useContext(ChatCtx);
  return v ?? NOOP_CTX;
}
