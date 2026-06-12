import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { Toaster } from "@rep/components/ui/toaster";
import { TooltipProvider } from "@rep/components/ui/tooltip";
import { AuthProvider, useAuth } from "@rep/lib/auth";
import { DialerProvider } from "@rep/contexts/DialerProvider";
import { CallScreen } from "@rep/components/CallScreen";
import RepLayout from "@rep/components/RepLayout";
import LoginPage from "@rep/pages/Login";
// 2026-05-21 — Rep training onboarding gate removed (Sprint 2 streamline).
import DashboardPage from "@rep/pages/Dashboard";
import AvailableLeadsPage from "@rep/pages/AvailableLeads";
import MyLeadsPage from "@rep/pages/MyLeads";
import LeadDetailPage from "@rep/pages/LeadDetail";
import CallbacksPage from "@rep/pages/Callbacks";
import InboundQueuePage from "@rep/pages/InboundQueue";
import CustomDevPage from "@rep/pages/CustomDev";
import NotificationsPage from "@rep/pages/Notifications";
import MessagesPage from "@rep/pages/Messages";
import CommissionPage from "@rep/pages/Commission";
import SettingsPage from "@rep/pages/Settings";
import NotFound from "@rep/pages/not-found";
import ResourcesPage from "@rep/pages/resources/Resources";
import CompanyPresentation from "@rep/pages/resources/CompanyPresentation";
import CallScripts from "@rep/pages/resources/CallScripts";
import ReferenceGuide from "@rep/pages/resources/ReferenceGuide";
import TrainingMaterials from "@rep/pages/resources/TrainingMaterials";
import PaymentPlans from "@rep/pages/resources/PaymentPlans";
import KBHub from "@rep/pages/kb/KBHub";
import PlayCards from "@rep/pages/resources/PlayCards";
import PhaseBFaqPage from "@rep/pages/PhaseBFaq";
import { KnowledgeBaseGate } from "@rep/components/KnowledgeBaseGate";
import { CandidateBanner } from "@rep/components/CandidateBanner";
import CandidateLanding from "@rep/pages/candidate/CandidateLanding";
import CandidateQuiz from "@rep/pages/candidate/CandidateQuiz";
import { getCandidateSession } from "@rep/lib/candidate";
import {
  recordKbView,
  flushKbReadingTrail,
} from "@rep/lib/kbReadingTrail";

const KB_SECTIONS: Record<string, { key: string; title: string }> = {
  "/kb": { key: "hub", title: "KB Hub" },
  "/kb/company": { key: "company", title: "Company Overview" },
  "/kb/call-scripts": { key: "call-scripts", title: "Call Scripts" },
  "/kb/reference": { key: "reference", title: "Reference Guide" },
  "/kb/training": { key: "training", title: "Training Materials" },
  "/kb/payment-plans": { key: "payment-plans", title: "Payment Plans & Earnings" },
  "/kb/play-cards": { key: "play-cards", title: "Play Cards" },
};

function useTrackKbReading(pathOnly: string) {
  useEffect(() => {
    if (!getCandidateSession()) return;
    const section = KB_SECTIONS[pathOnly];
    if (!section) return;
    recordKbView(section.key, section.title);
  }, [pathOnly]);

  useEffect(() => {
    if (!getCandidateSession()) return;
    const onHide = () => flushKbReadingTrail();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushKbReadingTrail();
    };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
      flushKbReadingTrail();
    };
  }, []);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const status = (error as { status?: number } | null)?.status;
        if (status === 401 || status === 403) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
  },
});

function RepRoutes() {
  const { user, loading } = useAuth();
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (loading || !user) return;
    // 2026-05-21 — rep training onboarding redirect removed (Sprint 2 streamline).
    void location;
    void navigate;
  }, [loading, user, location, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }
  if (!user) return <LoginPage />;
  // Admins can use the rep/sales dashboard too (e.g. maaz/faizan/shivkanya/kanav
  // run both /admin and /sales from one login). Only non-rep, non-admin roles
  // hit the mismatch screen.
  if (user.role !== "rep" && user.role !== "admin") {
    return <RoleMismatch />;
  }

  return (
    <RepLayout>
      <Switch>
        {/* 2026-05-21 — `/onboarding` route removed (rep training gate killed). */}
        <Route path="/" component={DashboardPage} />
        <Route path="/available" component={AvailableLeadsPage} />
        <Route path="/my-leads" component={MyLeadsPage} />
        <Route path="/my-leads/:tab" component={MyLeadsPage} />
        <Route path="/leads/:id" component={LeadDetailPage} />
        <Route path="/callbacks" component={CallbacksPage} />
        <Route path="/inbound" component={InboundQueuePage} />
        <Route path="/custom-dev" component={CustomDevPage} />
        <Route path="/notifications" component={NotificationsPage} />
        <Route path="/messages" component={MessagesPage} />
        <Route path="/commission" component={CommissionPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/resources" component={ResourcesPage} />
        <Route path="/resources/company" component={CompanyPresentation} />
        <Route path="/resources/call-scripts" component={CallScripts} />
        <Route path="/resources/reference" component={ReferenceGuide} />
        <Route path="/resources/training" component={TrainingMaterials} />
        <Route path="/resources/payment-plans" component={PaymentPlans} />
        <Route path="/resources/play-cards" component={PlayCards} />
        <Route path="/phase-b" component={PhaseBFaqPage} />
        <Route component={NotFound} />
      </Switch>
    </RepLayout>
  );
}

function RoleMismatch() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen grid place-items-center bg-background px-4">
      <div className="bg-card border border-card-border rounded-xl p-8 max-w-md text-center shadow-sm">
        <h1 className="font-serif text-2xl mb-2">Sales rep access only</h1>
        <p className="text-sm text-muted-foreground mb-4">
          Your account ({user?.displayName}) isn't a sales rep. Switch to
          the Ashford team dashboard, or sign in with a different account.
        </p>
        <button
          type="button"
          onClick={logout}
          className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90"
        >
          Log out
        </button>
      </div>
    </div>
  );
}

function KBRoutes() {
  const [location] = useLocation();
  // The KB hub renders its own candidate quiz hero, which replaces the thin
  // global banner there. Keep the banner on every KB sub-page so candidates
  // always know how to get back to the quiz. Normalize pathname so trailing
  // slashes / query strings / hashes don't accidentally show the banner.
  const pathOnly = location.split(/[?#]/, 1)[0].replace(/\/+$/, "");
  const isHub = pathOnly === "" || pathOnly === "/kb";
  const trackingPath = pathOnly === "" ? "/kb" : pathOnly;
  useTrackKbReading(trackingPath);
  return (
    <KnowledgeBaseGate>
      {!isHub && <CandidateBanner />}
      <Switch>
        <Route path="/kb" component={KBHub} />
        <Route path="/kb/company" component={CompanyPresentation} />
        <Route path="/kb/call-scripts" component={CallScripts} />
        <Route path="/kb/reference" component={ReferenceGuide} />
        <Route path="/kb/training" component={TrainingMaterials} />
        <Route path="/kb/payment-plans" component={PaymentPlans} />
        <Route path="/kb/play-cards" component={PlayCards} />
        <Route component={KBHub} />
      </Switch>
    </KnowledgeBaseGate>
  );
}

function CandidateRoutes() {
  return (
    <Switch>
      <Route path="/candidate" component={CandidateLanding} />
      <Route path="/candidate/quiz" component={CandidateQuiz} />
      <Route component={CandidateLanding} />
    </Switch>
  );
}

function AppContent() {
  const [location] = useLocation();
  if (location === "/candidate" || location.startsWith("/candidate/")) {
    return <CandidateRoutes />;
  }
  if (location === "/kb" || location.startsWith("/kb/")) {
    return <KBRoutes />;
  }
  return <RepRoutes />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <DialerProvider>
            <AppContent />
            <CallScreen />
          </DialerProvider>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
