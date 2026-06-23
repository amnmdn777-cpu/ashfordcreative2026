import { Component, type ReactNode } from "react";

/**
 * EB#3 (2026-06-23): a render crash inside a route used to blank the whole
 * rep app — Candice reported "the CRM won't open leads at all". This
 * boundary catches a render error for the current route and shows a
 * recoverable fallback instead, so one bad lead (or a transient data shape)
 * never takes down the entire CRM. Key it by `location` in the router so it
 * resets automatically when the rep navigates elsewhere.
 */
export class RouteErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Surfaced in the browser console + (if wired) Sentry. Kept lightweight
    // so the boundary itself can never throw.
    // eslint-disable-next-line no-console
    console.error("[rep] route render crashed:", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="p-6 md:p-10">
          <div className="max-w-lg bg-card border border-destructive/30 rounded-xl p-6 shadow-sm">
            <h2 className="font-serif text-xl mb-2 text-foreground">
              Something went wrong on this page
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              This screen hit an error and couldn't render. The rest of the
              app still works — go back and open another lead, or reload.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => this.setState({ error: null })}
                className="rounded-md bg-primary text-primary-foreground text-sm font-medium px-3 py-1.5 hover:bg-primary/90"
              >
                Try again
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-md border border-input bg-background text-sm font-medium px-3 py-1.5 hover:bg-muted"
              >
                Reload
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
