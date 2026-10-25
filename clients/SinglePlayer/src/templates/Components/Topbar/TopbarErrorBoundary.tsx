import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { fallback: ReactNode; children: ReactNode };

type State = { failed: boolean };

// error boundaries exist only as class components
export class TopbarErrorBoundary extends Component<Props, State> {
    state: State = { failed: false };

    static getDerivedStateFromError(): State {
        return { failed: true };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error(
            "The story's Topbar failed to render",
            error,
            info.componentStack
        );
    }

    render() {
        return this.state.failed ? this.props.fallback : this.props.children;
    }
}
