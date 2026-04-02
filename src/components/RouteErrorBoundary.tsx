import React, { type PropsWithChildren } from "react";
import { ActionButton, Panel } from "@/components/ui/primitives";

type RouteErrorBoundaryProps = PropsWithChildren<{
  title?: string;
}>;

type RouteErrorBoundaryState = {
  error: Error | null;
};

export default class RouteErrorBoundary extends React.Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  state: RouteErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("RouteErrorBoundary caught an error", error);
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto w-full max-w-4xl px-8 py-8">
          <Panel variant="hero" className="p-8">
            <p className="font-label text-[10px] uppercase tracking-[0.3em] text-destructive">
              Route Error
            </p>
            <h1 className="font-headline mt-3 text-3xl font-black tracking-[-0.05em] text-foreground">
              {this.props.title ?? "This page crashed"}
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {this.state.error.message || "An unexpected client-side error occurred."}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ActionButton onClick={this.handleReset}>Try again</ActionButton>
              <ActionButton variant="secondary" onClick={() => window.location.reload()}>
                Reload app
              </ActionButton>
            </div>
          </Panel>
        </div>
      );
    }

    return this.props.children;
  }
}
