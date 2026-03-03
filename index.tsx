
import React, { Component, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

// Global Error Boundary for Production Stability
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false };
  // Explicitly declare props to satisfy TypeScript if type inference fails
  public props: ErrorBoundaryProps;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.props = props;
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Critical App Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
          height: '100vh', backgroundColor: '#0f172a', color: '#fff', textAlign: 'center', padding: '20px' 
        }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#fbbf24' }}>Something went wrong</h2>
          <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>We encountered an unexpected issue.</p>
          <button 
            onClick={() => window.location.reload()} 
            style={{ 
              padding: '10px 20px', backgroundColor: '#fbbf24', color: '#000', border: 'none', 
              borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' 
            }}
          >
            Reload Website
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const renderApp = () => {
    const rootElement = document.getElementById('root');
    if (rootElement) {
        const root = ReactDOM.createRoot(rootElement);
        root.render(
            <React.StrictMode>
            <ErrorBoundary>
                <App />
            </ErrorBoundary>
            </React.StrictMode>
        );
    } else {
        console.error("Root element not found");
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderApp);
} else {
    renderApp();
}
