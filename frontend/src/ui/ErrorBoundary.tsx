import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary robusto para isolamento de falhas de renderização em gráficos e visualizações.
 * Impede que uma exceção em cálculo matemático/SVG derrube a página inteira.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Falha capturada na interface:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            background: 'var(--bg-1)',
            border: '1px solid var(--accent)',
            borderRadius: '4px',
            padding: '24px',
            margin: '16px 0',
            fontFamily: 'var(--mono)',
            textAlign: 'center',
          }}
        >
          <div style={{ color: 'var(--accent)', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
            ⚠️ {this.props.fallbackTitle || 'Não foi possível carregar este componente'}
          </div>
          <div style={{ color: 'var(--ink-3)', fontSize: '12px', marginBottom: '16px', maxWidth: '500px', margin: '0 auto 16px' }}>
            {this.props.fallbackMessage || 'Ocorreu uma falha no cálculo gráfico ou na renderização dos dados.'}
          </div>
          <button
            onClick={this.handleRetry}
            className="header-btn"
            style={{
              padding: '8px 18px',
              fontSize: '12px',
              cursor: 'pointer',
              background: 'var(--bg-2)',
              border: '1px solid var(--rule)',
            }}
          >
            🔄 Tentar novamente
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
