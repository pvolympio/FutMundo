import { useState, useEffect } from 'react';

/**
 * Banner de conectividade que detecta queda de rede e avisa que o app
 * está operando em cache sem interromper a navegação.
 */
export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [dismissed, setDismissed] = useState<boolean>(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setDismissed(false);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setDismissed(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline || dismissed) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        background: 'var(--bg-2, #18191c)',
        borderBottom: '1px solid var(--down, #ef4444)',
        color: 'var(--ink)',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '12px',
        fontFamily: 'var(--mono)',
        zIndex: 9999,
        position: 'sticky',
        top: 0,
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#ef4444',
            display: 'inline-block',
            boxShadow: '0 0 8px #ef4444',
            animation: 'pulse 1.8s infinite',
          }}
        />
        <span>
          <strong style={{ color: '#ef4444', marginRight: '6px' }}>MODO OFFLINE:</strong>
          Sem conexão com a rede. Exibindo métricas em cache local do navegador.
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={() => {
            if (navigator.onLine) {
              setIsOnline(true);
            } else {
              window.location.reload();
            }
          }}
          className="header-btn"
          style={{ padding: '3px 8px', fontSize: '10px', fontFamily: 'var(--mono)' }}
        >
          Reconectar
        </button>
        <button
          onClick={() => setDismissed(true)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--ink-3)',
            cursor: 'pointer',
            fontSize: '14px',
            padding: '0 4px',
          }}
          aria-label="Dispensar aviso de offline"
        >
          ×
        </button>
      </div>
    </div>
  );
}

export default OfflineBanner;
