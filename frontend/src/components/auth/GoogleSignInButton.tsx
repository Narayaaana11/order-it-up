'use client';

import { useEffect, useRef, useState } from 'react';

type GoogleCredentialResponse = { credential?: string };
type GoogleIdentityApi = {
  initialize: (options: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select?: boolean;
  }) => void;
  renderButton: (parent: HTMLElement, options: Record<string, string | number | boolean>) => void;
};
declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdentityApi } };
  }
}

type Props = {
  onCredential: (credential: string) => void | Promise<void>;
  disabled?: boolean;
};

export default function GoogleSignInButton({ onCredential, disabled = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onCredential);
  const [scriptError, setScriptError] = useState(false);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    callbackRef.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    if (!clientId || !containerRef.current) return;
    let cancelled = false;

    const renderGoogleButton = () => {
      if (cancelled || !containerRef.current || !window.google?.accounts?.id) return;
      containerRef.current.replaceChildren();
      window.google.accounts.id.initialize({
        client_id: clientId,
        auto_select: false,
        callback: (response) => {
          if (response.credential) void callbackRef.current(response.credential);
        },
      });
      window.google.accounts.id.renderButton(containerRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        width: 320,
        logo_alignment: 'left',
      });
    };

    if (window.google?.accounts?.id) {
      renderGoogleButton();
    } else {
      let script = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
      if (!script) {
        script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      const onLoad = () => renderGoogleButton();
      const onError = () => setScriptError(true);
      script.addEventListener('load', onLoad);
      script.addEventListener('error', onError);
      if (window.google?.accounts?.id) renderGoogleButton();
      return () => {
        cancelled = true;
        script?.removeEventListener('load', onLoad);
        script?.removeEventListener('error', onError);
      };
    }

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (!clientId) {
    return (
      <p className="text-center text-xs text-muted-foreground">
        Google sign-in is not configured for this deployment yet.
      </p>
    );
  }

  return (
    <div className={disabled ? 'pointer-events-none opacity-50' : ''}>
      <div ref={containerRef} className="flex min-h-11 justify-center" aria-label="Continue with Google" />
      {scriptError && (
        <p role="alert" className="mt-2 text-center text-xs text-destructive">
          Google sign-in could not load. Check your connection and try again.
        </p>
      )}
    </div>
  );
}
