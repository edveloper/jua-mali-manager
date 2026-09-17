import { Component, ErrorInfo, ReactNode } from 'react';

/**
 * Something other than a blank white screen.
 *
 * React unmounts the whole tree when a render throws and nothing catches it,
 * which on a phone looks exactly like the app failing to load. The person
 * refreshes, it works, and they learn the app is unreliable. Anything at all on
 * screen beats that, even an apology with a button.
 */
interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Something threw during render:', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="sheet max-w-sm text-center space-y-3">
          <p className="font-semibold">Something Went Wrong</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Nothing is lost. Your records are safe on the server. Loading the app
            again usually sorts it.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full rounded-md bg-primary text-primary-foreground py-2.5 font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }
}
