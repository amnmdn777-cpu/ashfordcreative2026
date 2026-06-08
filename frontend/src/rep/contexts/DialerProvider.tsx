import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "@rep/lib/api";
import { useAuth } from "@rep/lib/auth";

// Dialpad model: server places the call via Dialpad's REST API. The rep's
// Dialpad device (desk phone or app) rings first, then bridges to the
// prospect — no browser audio path. Status mirrors that simpler flow.

type DialerStatus =
  | "idle"
  | "connecting"
  | "ready"
  | "in-call"
  | "unavailable"
  | "error";

export interface ActiveCallInfo {
  callId: number | null;
  leadId: number | null;
  direction: "outbound" | "inbound";
  remoteNumber: string;
  leadName?: string | null;
  practiceName?: string | null;
  startedAt: number;
  muted: boolean;
}

export interface PlaceCallArgs {
  leadId: number | null;
  practiceName?: string | null;
  toNumber: string;
}

export interface DialerContextValue {
  status: DialerStatus;
  errorMessage: string | null;
  active: ActiveCallInfo | null;
  dailyCapBlocked: boolean;
  /** True when the server has per-rep Dialpad OAuth enabled. When false
   * the legacy shared-key flow is in use and Connect/Disconnect UI is
   * hidden on the Settings page. */
  perRepOauth: boolean;
  /** True when THIS rep has connected her own Dialpad seat. The Call
   * button on each lead is gated on this when `perRepOauth` is on. */
  repConnected: boolean;
  placeCall: (args: PlaceCallArgs) => Promise<number>;
  acceptIncoming: () => void;
  rejectIncoming: () => void;
  hangUp: () => void;
  toggleMute: () => void;
  sendDtmf: (digit: string) => void;
  reconnect: () => Promise<void>;
}

const DialerContext = createContext<DialerContextValue | null>(null);

export function DialerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [status, setStatus] = useState<DialerStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [active, setActive] = useState<ActiveCallInfo | null>(null);
  const [dailyCapBlocked, setDailyCapBlocked] = useState(false);
  const [perRepOauth, setPerRepOauth] = useState(false);
  const [repConnected, setRepConnected] = useState(false);

  const refreshStatus = useCallback(async () => {
    if (!user || user.role !== "rep") {
      setStatus("idle");
      setDailyCapBlocked(false);
      setPerRepOauth(false);
      setRepConnected(false);
      return;
    }
    setStatus((s) => (s === "in-call" ? s : "connecting"));
    try {
      const s = await api.voiceStatus();
      setDailyCapBlocked(Boolean(s?.dailyCap?.blocked));
      setPerRepOauth(Boolean(s?.perRepOauth));
      setRepConnected(Boolean(s?.repConnected));
      setStatus((prev) =>
        prev === "in-call" ? prev : s.configured ? "ready" : "unavailable",
      );
    } catch {
      setStatus((prev) => (prev === "in-call" ? prev : "error"));
    }
  }, [user]);

  useEffect(() => {
    void refreshStatus();
    const id = setInterval(refreshStatus, 60_000);
    return () => clearInterval(id);
  }, [refreshStatus]);

  const placeCall = useCallback(
    async ({ leadId, toNumber, practiceName }: PlaceCallArgs): Promise<number> => {
      setErrorMessage(null);
      const result = await api.voiceStart({ leadId, toNumber }).catch((err) => {
        const msg = err instanceof Error ? err.message : "Failed to place call";
        setErrorMessage(msg);
        throw err;
      });
      setActive({
        callId: result.callId,
        leadId,
        direction: "outbound",
        remoteNumber: practiceName ? `${practiceName} (${toNumber})` : toNumber,
        startedAt: Date.now(),
        muted: false,
      });
      setStatus("in-call");
      return result.callId;
    },
    [],
  );

  // Audio path is the rep's Dialpad device, not the browser. The card is
  // just a UI hint — "Dismiss" clears it; mute/keypad/hang-up happen on
  // the rep's phone itself.
  const hangUp = useCallback(() => {
    setActive(null);
    setStatus((prev) => (prev === "in-call" ? "ready" : prev));
  }, []);
  const acceptIncoming = useCallback(() => {}, []);
  const rejectIncoming = useCallback(() => {}, []);
  const toggleMute = useCallback(() => {}, []);
  const sendDtmf = useCallback((_digit: string) => {}, []);
  const reconnect = useCallback(async () => {
    await refreshStatus();
  }, [refreshStatus]);

  const value = useMemo<DialerContextValue>(
    () => ({
      status,
      errorMessage,
      active,
      dailyCapBlocked,
      perRepOauth,
      repConnected,
      placeCall,
      acceptIncoming,
      rejectIncoming,
      hangUp,
      toggleMute,
      sendDtmf,
      reconnect,
    }),
    [
      status,
      errorMessage,
      active,
      dailyCapBlocked,
      perRepOauth,
      repConnected,
      placeCall,
      acceptIncoming,
      rejectIncoming,
      hangUp,
      toggleMute,
      sendDtmf,
      reconnect,
    ],
  );

  return <DialerContext.Provider value={value}>{children}</DialerContext.Provider>;
}

export function useDialer(): DialerContextValue {
  const ctx = useContext(DialerContext);
  if (!ctx) throw new Error("useDialer must be used inside a DialerProvider");
  return ctx;
}
