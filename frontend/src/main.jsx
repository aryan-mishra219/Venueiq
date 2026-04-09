import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Error Boundary to catch and display errors instead of black screen
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('VenueIQ Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px',
          color: '#ff4444',
          background: '#1a1a2e',
          minHeight: '100vh',
          fontFamily: 'monospace',
        }}>
          <h1 style={{ color: '#ff6b6b', marginBottom: '16px' }}>⚠️ VenueIQ Error</h1>
          <p style={{ color: '#e8eaed', marginBottom: '12px' }}>Something crashed. Here is the error:</p>
          <pre style={{
            padding: '16px',
            background: '#0a0a1a',
            borderRadius: '8px',
            overflow: 'auto',
            fontSize: '13px',
            lineHeight: '1.6',
            border: '1px solid #333',
          }}>
            {this.state.error && this.state.error.toString()}
            {'\n\n'}
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
