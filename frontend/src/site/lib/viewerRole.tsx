import React, { createContext, useContext, useMemo } from "react";

export type ViewerRole = "prospect" | "rep" | "admin";

const ViewerRoleContext = createContext<ViewerRole>("prospect");

/**
 * Default 'prospect' (most defensive). The prospect-portal route opts
 * in to 'rep' or 'admin' only when the URL carries an explicit query
 * flag so a rep can preview their own chrome — never inferred from a
 * cookie that the prospect's browser might also carry. Founder
 * feedback 2026-05-17: internal badges ("Pages we\'ve already
 * drafted for you", "Preview Quality Check", etc.) must never
 * render under viewerRole === 'prospect'.
 */
export function ViewerRoleProvider({
  role,
  children,
}: {
  role: ViewerRole;
  children: React.ReactNode;
}) {
  const safe: ViewerRole = useMemo(
    () => (role === "rep" || role === "admin" ? role : "prospect"),
    [role],
  );
  return (
    <ViewerRoleContext.Provider value={safe}>
      {children}
    </ViewerRoleContext.Provider>
  );
}

export function useViewerRole(): ViewerRole {
  return useContext(ViewerRoleContext);
}

/** Convenience: true when the rendering surface is internal-facing. */
export function useIsInternalViewer(): boolean {
  const role = useViewerRole();
  return role === "rep" || role === "admin";
}

/** Reads `?viewer=rep|admin` from the URL once at mount. Returns
 * 'prospect' for any other value so the public preview is never
 * accidentally upgraded to internal mode. */
export function readViewerRoleFromUrl(): ViewerRole {
  if (typeof window === "undefined") return "prospect";
  try {
    const params = new URLSearchParams(window.location.search);
    const v = (params.get("viewer") || "").toLowerCase();
    if (v === "rep") return "rep";
    if (v === "admin") return "admin";
  } catch {
    /* ignore */
  }
  return "prospect";
}
