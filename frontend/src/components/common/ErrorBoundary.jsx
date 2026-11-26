import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught page error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallbackStyle === 'minimal') {
        return (
          <div style={{ padding: '0.6rem 1rem', background: '#fee2e2', color: '#dc2626', borderRadius: '8px', margin: '0.5rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'space-between', border: '1px solid #fecaca' }}>
            <span>{this.props.title || 'Component temporarily unavailable'}</span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              <RefreshCw size={12} /> Reload
            </button>
          </div>
        );
      }
      return (
        <div className="card" style={{ padding: '2.5rem 1.5rem', textAlign: 'center', margin: '2rem auto', maxWidth: '580px' }}>
          <AlertTriangle size={44} style={{ color: 'var(--danger, #dc2626)', margin: '0 auto 1rem' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--neutral-900)' }}>
            {this.props.title || 'Unable to display this view'}
          </h3>
          <p className="text-muted text-sm" style={{ marginBottom: '1.5rem', lineHeight: '1.5' }}>
            {this.state.error?.message || 'An unexpected rendering error occurred. Please try reloading this section.'}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              <RefreshCw size={14} /> Try Reloading
            </button>
            {this.props.onReset && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  this.props.onReset();
                }}
              >
                Return to Dashboard
              </button>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
