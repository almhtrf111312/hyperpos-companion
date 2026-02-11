import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center p-4 bg-background text-foreground" dir="rtl">
                    <div className="max-w-md w-full bg-card border border-destructive/20 rounded-xl p-6 shadow-lg text-center">
                        <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertTriangle className="w-8 h-8 text-destructive" />
                        </div>
                        <h1 className="text-xl font-bold mb-2">عذراً، حدث خطأ غير متوقع</h1>
                        <p className="text-muted-foreground mb-6">
                            واجه التطبيق مشكلة تمنعه من العمل بشكل صحيح.
                        </p>

                        {this.state.error && (
                            <div className="bg-muted p-3 rounded-lg text-xs text-left font-mono overflow-auto max-h-40 mb-6 dir-ltr select-text">
                                {this.state.error.toString()}
                            </div>
                        )}

                        <button
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors w-full font-medium"
                        >
                            إعادة تحميل التطبيق
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
