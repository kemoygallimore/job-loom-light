import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isChunkLoadError } from "@/lib/lazyWithRetry";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(error, errorInfo);
  }

  render() {
    if (!this.state.error) return this.props.children;

    const isStaleAppShell = isChunkLoadError(this.state.error);
    const title = isStaleAppShell ? "Update available" : "Something went wrong";
    const message = isStaleAppShell
      ? "We need to refresh the app to finish loading the latest version."
      : "We hit an unexpected issue. Reloading the app usually clears it.";

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{message}</p>
            {import.meta.env.DEV ? (
              <p className="break-words rounded-md bg-muted p-3 text-xs text-muted-foreground">
                {this.state.error.message}
              </p>
            ) : null}
            <Button onClick={() => window.location.reload()}>Reload app</Button>
          </CardContent>
        </Card>
      </div>
    );
  }
}
