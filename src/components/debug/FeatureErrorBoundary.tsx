import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { captureError } from '@/lib/error-radar';

interface FeatureErrorBoundaryProps {
  children: ReactNode;
  featureName?: string;
  fallbackTitle?: string;
  compact?: boolean;
}

interface FeatureErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class FeatureErrorBoundary extends Component<
  FeatureErrorBoundaryProps,
  FeatureErrorBoundaryState
> {
  constructor(props: FeatureErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): FeatureErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    try {
      captureError(error, {
        source: 'react_boundary',
        componentStack: errorInfo.componentStack || undefined,
        metadata: {
          feature: this.props.featureName || 'UnknownFeature',
        },
      });
    } catch (loggingError) {
      console.error('[FeatureErrorBoundary] Error logging failed:', loggingError);
    }
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.compact) {
        return (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>تعذّر عرض {this.props.featureName || 'هذا العنصر'}</span>
            </div>
            <Button className="h-7 gap-1 px-2 text-xs" onClick={this.handleRetry} size="sm" variant="outline">
              <RotateCcw className="h-3 w-3" />
              إعادة المحاولة
            </Button>
          </div>
        );
      }

      return (
        <div className="my-4 flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-card p-6 text-center shadow-sm">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h3 className="mb-1 text-base font-semibold text-foreground">
            {this.props.fallbackTitle || 'تعذّر عرض هذا القسم مؤقتاً'}
          </h3>
          <p className="mb-4 max-w-md text-xs text-muted-foreground">
            {this.props.featureName
              ? `حدث خطأ غير متوقع داخل قسم (${this.props.featureName}). بقية النظام وسلة المبيعات تعمل بشكل طبيعي.`
              : 'حدث خطأ غير متوقع في هذا القسم فقط. بقية النظام يعمل بشكل طبيعي.'}
          </p>
          {this.state.error?.message && (
            <pre
              className="mb-4 max-w-full overflow-x-auto rounded bg-muted px-3 py-1.5 font-mono text-[11px] text-muted-foreground"
              dir="ltr"
            >
              {this.state.error.message}
            </pre>
          )}
          <Button className="gap-2" onClick={this.handleRetry} size="sm" variant="default">
            <RotateCcw className="h-4 w-4" />
            إعادة المحاولة
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default FeatureErrorBoundary;
