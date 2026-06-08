import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@admin/components/ui/toaster";
import { TooltipProvider } from "@admin/components/ui/tooltip";
import { AuthProvider, useAuth } from "@admin/lib/auth";
import AdminLayout from "@admin/components/AdminLayout";
import LoginPage from "@admin/pages/Login";
import DashboardPage from "@admin/pages/Dashboard";
import LeadsPage from "@admin/pages/Leads";
import LeadDetailPage from "@admin/pages/LeadDetail";
import RepsPage from "@admin/pages/Reps";
import RepDetailPage from "@admin/pages/RepDetail";
import CustomDevPage from "@admin/pages/CustomDev";
import ContactRequestsPage from "@admin/pages/ContactRequests";
import SubscriptionsPage from "@admin/pages/Subscriptions";
import OnboardingsPage from "@admin/pages/Onboardings";
import AuditPage from "@admin/pages/Audit";
import PublicOnboardingPage from "@admin/pages/PublicOnboarding";
import CandidatesPage from "@admin/pages/Candidates";
import CandidateDetailPage from "@admin/pages/CandidateDetail";
import ApprovalsPage from "@admin/pages/Approvals";
import TranscriptsPage from "@admin/pages/Transcripts";
import TranscriptDetailPage from "@admin/pages/TranscriptDetail";
import EditorialQueuePage from "@admin/pages/EditorialQueue";
import EditorialEditPage from "@admin/pages/EditorialEdit";
import NotificationsPage from "@admin/pages/Notifications";
import NotFound from "@admin/pages/not-found";

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

function AdminRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }
  if (!user) return <LoginPage />;
  if (user.role !== "admin") {
    return (
      <div className="min-h-screen grid place-items-center bg-background px-4">
        <div className="bg-card border border-card-border rounded-xl p-8 max-w-md text-center shadow-sm">
          <h1 className="font-serif text-2xl mb-2">Admin access required</h1>
          <p className="text-sm text-muted-foreground mb-4">
            Your account ({user.displayName}) is a rep, not an admin.
            Use the rep dashboard instead.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AdminLayout>
      <Switch>
        <Route path="/" component={DashboardPage} />
        <Route path="/leads" component={LeadsPage} />
        <Route path="/leads/:id" component={LeadDetailPage} />
        <Route path="/reps" component={RepsPage} />
        <Route path="/reps/:id" component={RepDetailPage} />
        <Route path="/custom-dev" component={CustomDevPage} />
        <Route path="/contact-requests" component={ContactRequestsPage} />
        <Route path="/subscriptions" component={SubscriptionsPage} />
        <Route path="/onboardings" component={OnboardingsPage} />
        <Route path="/approvals" component={ApprovalsPage} />
        <Route path="/transcripts" component={TranscriptsPage} />
        <Route path="/transcripts/:leadId" component={TranscriptDetailPage} />
        <Route path="/audit" component={AuditPage} />
        <Route path="/concierge-journal" component={EditorialQueuePage} />
        <Route path="/editorial" component={EditorialQueuePage} />
        <Route path="/editorial/:scheduleId/edit" component={EditorialEditPage} />
        <Route path="/candidates" component={CandidatesPage} />
        <Route path="/candidates/:id" component={CandidateDetailPage} />
        <Route path="/notifications" component={NotificationsPage} />
        <Route component={NotFound} />
      </Switch>
    </AdminLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Switch>
          <Route path="/onboarding/:token" component={PublicOnboardingPage} />
          <Route>
            <AuthProvider>
              <AdminRoutes />
            </AuthProvider>
          </Route>
        </Switch>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
