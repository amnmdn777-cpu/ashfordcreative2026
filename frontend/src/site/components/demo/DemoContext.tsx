import { createContext, useContext, type ReactNode } from "react";
import type { TemplateKey } from "@workspace/api-zod";

/**
 * DemoContext flags that the current render is the /template/<key> sales
 * showcase, NOT a published prospect site. Components that surface the
 * "where does this feature live?" pulse-dots read this context and stay
 * silent on real published sites.
 *
 * The provider is only mounted by TemplateRoute. ProspectPortal does not
 * wrap its template in this provider, so prospects never see the dots.
 */

type DemoCtx = { active: boolean; templateKey: TemplateKey | null };

const DemoContext = createContext<DemoCtx>({ active: false, templateKey: null });

export function DemoProvider({
  children,
  templateKey,
}: {
  children: ReactNode;
  templateKey: TemplateKey;
}) {
  return (
    <DemoContext.Provider value={{ active: true, templateKey }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  return useContext(DemoContext);
}
