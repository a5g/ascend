import React from 'react';

interface Props {
  name: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class MfeErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: unknown): State {
    // Normalize non-standard MF error objects (Proxies, circular refs) into a
    // plain Error so React's own console.error call never throws.
    const normalized =
      error instanceof Error
        ? error
        : new Error(MfeErrorBoundary.safeString(error));
    return { hasError: true, error: normalized };
  }

  componentDidCatch(error: unknown) {
    console.warn(`[MFE] ${this.props.name} failed to load:`, MfeErrorBoundary.safeString(error));
  }

  private static safeString(e: unknown): string {
    try { return String((e as any)?.message ?? e); } catch { return '(unserializable error)'; }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}
