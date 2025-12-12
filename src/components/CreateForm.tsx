import { useState } from 'react';
import { generateKey, encrypt, createShareUrl } from '../lib/crypto';

interface ExpirationOption {
  value: number;
  label: string;
}

const EXPIRATION_OPTIONS: ExpirationOption[] = [
  { value: 3600, label: '1 hour' },
  { value: 86400, label: '24 hours' },
  { value: 259200, label: '3 days' },
  { value: 604800, label: '7 days' },
];

type FormState = 'idle' | 'encrypting' | 'sending' | 'success' | 'error';

export default function CreateForm() {
  const [secret, setSecret] = useState('');
  const [expiresIn, setExpiresIn] = useState(86400);
  const [state, setState] = useState<FormState>('idle');
  const [shareUrl, setShareUrl] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!secret.trim()) {
      setError('Please enter a secret to share');
      return;
    }

    setError('');
    setState('encrypting');

    try {
      // Generate client-side key
      const clientKey = await generateKey();

      // Encrypt the secret
      const encryptedData = await encrypt(secret, clientKey);

      setState('sending');

      // Send to API
      const response = await fetch('/api/secrets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          encryptedData,
          expiresIn,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create secret');
      }

      const data = await response.json();

      // Create shareable URL with client key in hash
      const url = createShareUrl(data.id, clientKey);
      setShareUrl(url);
      setState('success');
    } catch (err) {
      console.error('Error creating secret:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      setState('error');
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleReset = () => {
    setSecret('');
    setShareUrl('');
    setState('idle');
    setError('');
    setCopied(false);
  };

  if (state === 'success') {
    return (
      <div className="create-form-success">
        <div className="success-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="12" cy="12" r="10" />
          </svg>
        </div>
        <h3>Secret Link Created!</h3>
        <p className="success-message">
          Share this link with your recipient. It can only be viewed once.
        </p>
        <div className="url-container">
          <input
            type="text"
            readOnly
            value={shareUrl}
            className="url-input"
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          <button
            type="button"
            onClick={handleCopy}
            className={`copy-btn ${copied ? 'copied' : ''}`}
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
                Copy Link
              </>
            )}
          </button>
        </div>
        <button type="button" onClick={handleReset} className="create-another-btn">
          Create Another Secret
        </button>
      </div>
    );
  }

  const isLoading = state === 'encrypting' || state === 'sending';

  return (
    <form onSubmit={handleSubmit} className="create-form">
      <div className="form-group">
        <label htmlFor="secret" className="form-label">
          Your Secret
        </label>
        <textarea
          id="secret"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="Enter the password, API key, or sensitive text you want to share..."
          className="form-textarea"
          disabled={isLoading}
          rows={5}
        />
      </div>

      <div className="form-row">
        <div className="form-group expiration-group">
          <label htmlFor="expiration" className="form-label">
            Expires in
          </label>
          <select
            id="expiration"
            value={expiresIn}
            onChange={(e) => setExpiresIn(Number(e.target.value))}
            className="form-select"
            disabled={isLoading}
          >
            {EXPIRATION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <button type="submit" disabled={isLoading || !secret.trim()} className="submit-btn">
          {isLoading ? (
            <>
              <span className="spinner" />
              {state === 'encrypting' ? 'Encrypting...' : 'Creating Link...'}
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
              Create Secret Link
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="error-message">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}

      <p className="security-note">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        Your secret is encrypted in your browser before being sent. We never see your data.
      </p>
    </form>
  );
}
