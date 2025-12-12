import { useState, useEffect } from 'react';
import { decrypt, getKeyFromHash, isValidKey } from '../lib/crypto';

interface ViewSecretProps {
  secretId: string;
}

type ViewState = 'loading' | 'ready' | 'revealing' | 'revealed' | 'error' | 'not_found' | 'invalid_key';

const REVEAL_DELAY = 3000; // 3 seconds

export default function ViewSecret({ secretId }: ViewSecretProps) {
  const [state, setState] = useState<ViewState>('loading');
  const [secret, setSecret] = useState('');
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(REVEAL_DELAY / 1000);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Validate key from URL hash
    const key = getKeyFromHash();

    if (!key) {
      setState('invalid_key');
      return;
    }

    // Simulate initial loading
    const timer = setTimeout(() => {
      setState('ready');
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (state === 'ready' && countdown > 0) {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [state, countdown]);

  const handleReveal = async () => {
    const key = getKeyFromHash();

    if (!key) {
      setState('invalid_key');
      return;
    }

    setState('revealing');

    try {
      // Fetch the secret from API
      const response = await fetch(`/api/secrets/${secretId}`);

      if (response.status === 404) {
        setState('not_found');
        return;
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to retrieve secret');
      }

      const data = await response.json();

      // Decrypt client-side
      const decrypted = await decrypt(data.encryptedData, key);
      setSecret(decrypted);
      setState('revealed');
    } catch (err) {
      console.error('Error revealing secret:', err);
      setError(err instanceof Error ? err.message : 'Failed to decrypt secret');
      setState('error');
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Loading state
  if (state === 'loading') {
    return (
      <div className="view-secret view-secret--loading">
        <div className="loading-spinner" />
        <p>Preparing secure viewer...</p>
      </div>
    );
  }

  // Invalid key
  if (state === 'invalid_key') {
    return (
      <div className="view-secret view-secret--error">
        <div className="error-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <h2>Invalid Link</h2>
        <p>This link is missing the encryption key. It may have been truncated or modified.</p>
        <p className="error-note">
          Please ask the sender to share the complete link, including everything after the # symbol.
        </p>
        <a href="/" className="btn btn--primary">
          Create New Secret
        </a>
      </div>
    );
  }

  // Not found
  if (state === 'not_found') {
    return (
      <div className="view-secret view-secret--not-found">
        <div className="not-found-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        </div>
        <h2>Secret Not Found</h2>
        <p>This secret has already been viewed or has expired.</p>
        <p className="not-found-note">
          Remember, secrets can only be viewed once. If you need to share the information again,
          ask the sender to create a new link.
        </p>
        <a href="/" className="btn btn--primary">
          Create New Secret
        </a>
      </div>
    );
  }

  // Error state
  if (state === 'error') {
    return (
      <div className="view-secret view-secret--error">
        <div className="error-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2>Something Went Wrong</h2>
        <p>{error || 'Unable to decrypt the secret. The link may be corrupted.'}</p>
        <a href="/" className="btn btn--primary">
          Create New Secret
        </a>
      </div>
    );
  }

  // Revealed state
  if (state === 'revealed') {
    return (
      <div className="view-secret view-secret--revealed">
        <div className="revealed-header">
          <div className="revealed-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </div>
          <h2>Secret Revealed</h2>
          <p className="revealed-warning">
            This secret has been permanently deleted from our servers.
          </p>
        </div>

        <div className="secret-container">
          <pre className="secret-content">{secret}</pre>
          <button
            type="button"
            onClick={handleCopy}
            className={`copy-secret-btn ${copied ? 'copied' : ''}`}
          >
            {copied ? (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
                Copy
              </>
            )}
          </button>
        </div>

        <div className="deleted-notice">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
          </svg>
          <span>This secret is now gone forever. This link will no longer work.</span>
        </div>

        <a href="/" className="create-new-link">
          Create your own secret link
        </a>
      </div>
    );
  }

  // Ready to reveal state
  const canReveal = countdown === 0;

  return (
    <div className="view-secret view-secret--ready">
      <div className="ready-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0110 0v4" />
        </svg>
      </div>

      <h2>You've Received a Secret</h2>

      <div className="warning-box">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <div>
          <strong>One-Time View</strong>
          <p>This secret can only be viewed once. After you reveal it, it will be permanently deleted.</p>
        </div>
      </div>

      <button
        type="button"
        onClick={handleReveal}
        disabled={!canReveal || state === 'revealing'}
        className="reveal-btn"
      >
        {state === 'revealing' ? (
          <>
            <span className="spinner" />
            Decrypting...
          </>
        ) : canReveal ? (
          <>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Reveal Secret
          </>
        ) : (
          <>
            <div className="countdown-ring">
              <svg viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="16" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.2" />
                <circle
                  cx="18"
                  cy="18"
                  r="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray={`${((REVEAL_DELAY / 1000 - countdown) / (REVEAL_DELAY / 1000)) * 100} 100`}
                  strokeLinecap="round"
                  transform="rotate(-90 18 18)"
                />
              </svg>
              <span>{countdown}</span>
            </div>
            Please wait...
          </>
        )}
      </button>

      <p className="delay-explanation">
        The brief delay helps protect against accidental viewing by email scanners and link previews.
      </p>
    </div>
  );
}
