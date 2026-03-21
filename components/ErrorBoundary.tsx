import React from 'react';

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: string;
}

interface ErrorBoundaryProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    props!: ErrorBoundaryProps;
    state: ErrorBoundaryState;
    setState!: React.Component<ErrorBoundaryProps, ErrorBoundaryState>['setState'];

    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: '' };
    }

    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        this.setState({ errorInfo: info.componentStack || '' });
        console.error('[XitChat ErrorBoundary]', error, info);
    }

    handleReload = () => {
        this.setState({ hasError: false, error: null, errorInfo: '' });
        window.location.reload();
    };

    handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: '' });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;

            return (
                <div className="flex-1 flex flex-col items-center justify-center bg-black p-8 font-mono">
                    <div className="max-w-md w-full border border-red-500 bg-[#050505] p-8 shadow-[0_0_40px_rgba(255,0,0,0.2)]">

                        {/* Header */}
                        <div className="flex items-center gap-3 mb-6">
                            <i className="fa-solid fa-triangle-exclamation text-red-500 text-2xl animate-pulse"></i>
                            <div>
                                <h2 className="text-red-500 font-bold uppercase tracking-widest text-sm">kernel_panic.err</h2>
                                <p className="text-red-500/40 text-[9px] uppercase tracking-widest">component_crash_detected</p>
                            </div>
                        </div>

                        <div className="h-px bg-red-500/20 mb-6"></div>

                        {/* Error message */}
                        <div className="bg-black/50 border border-red-500/20 p-4 mb-6">
                            <p className="text-red-400/80 text-[10px] font-mono break-all leading-relaxed">
                                &gt; {this.state.error?.message || 'Unknown error occurred'}
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="space-y-3">
                            <button
                                onClick={this.handleReset}
                                className="w-full py-3 border border-red-500/40 text-red-400 hover:border-red-500 hover:bg-red-500/10 uppercase text-[10px] tracking-[0.3em] font-bold transition-all"
                            >
                                try_recover
                            </button>
                            <button
                                onClick={this.handleReload}
                                className="w-full py-3 bg-red-900/40 border border-red-500 text-red-400 hover:bg-red-500 hover:text-white uppercase text-[10px] tracking-[0.3em] font-bold transition-all"
                            >
                                reboot_node
                            </button>
                        </div>

                        <p className="text-white/10 text-[8px] uppercase tracking-widest mt-6 text-center">
                            xitchat v1.0.1 // error_logged
                        </p>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
