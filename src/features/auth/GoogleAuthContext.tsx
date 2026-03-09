/**
 * Google Auth Context — Client-side Google OAuth using Google Identity Services
 * Manages sign-in state and access tokens for Sheets/Drive API.
 */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '797349464481-6mihrvf8msqsmg623gf96e6i8ivrfs7f.apps.googleusercontent.com';
const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
].join(' ');

interface GoogleUser {
  email: string;
  name: string;
  picture: string;
}

interface GoogleAuthContextType {
  user: GoogleUser | null;
  accessToken: string | null;
  isSignedIn: boolean;
  isLoading: boolean;
  signIn: () => void;
  signOut: () => void;
  error: string | null;
}

const GoogleAuthContext = createContext<GoogleAuthContextType>({
  user: null,
  accessToken: null,
  isSignedIn: false,
  isLoading: true,
  signIn: () => {},
  signOut: () => {},
  error: null,
});

export const useGoogleAuth = () => useContext(GoogleAuthContext);

// Load the Google Identity Services script
function loadGsiScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById('google-gsi-script')) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-gsi-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
}

export function GoogleAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokenClient, setTokenClient] = useState<any>(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      setError('Google Client ID not configured. Set VITE_GOOGLE_CLIENT_ID.');
      setIsLoading(false);
      return;
    }

    loadGsiScript().then(() => {
      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: async (response: any) => {
          if (response.error) {
            setError(response.error);
            return;
          }
          setAccessToken(response.access_token);
          // Fetch user info
          try {
            const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
              headers: { Authorization: `Bearer ${response.access_token}` },
            });
            const info = await res.json();
            const userData = { email: info.email, name: info.name, picture: info.picture };
            setUser(userData);
            localStorage.setItem('sheetsync_user', JSON.stringify(userData));
            setError(null);
          } catch (e) {
            setError('Failed to fetch user info');
          }
        },
      });
      setTokenClient(client);

      // Check for cached user
      const cached = localStorage.getItem('sheetsync_user');
      if (cached) {
        try {
          setUser(JSON.parse(cached));
        } catch {}
      }
      setIsLoading(false);
    }).catch((err) => {
      setError(err.message);
      setIsLoading(false);
    });
  }, []);

  const signIn = useCallback(() => {
    if (tokenClient) {
      tokenClient.requestAccessToken();
    }
  }, [tokenClient]);

  const signOut = useCallback(() => {
    if (accessToken) {
      (window as any).google?.accounts?.oauth2?.revoke?.(accessToken);
    }
    setUser(null);
    setAccessToken(null);
    localStorage.removeItem('sheetsync_user');
  }, [accessToken]);

  return (
    <GoogleAuthContext.Provider
      value={{
        user,
        accessToken,
        isSignedIn: !!accessToken && !!user,
        isLoading,
        signIn,
        signOut,
        error,
      }}
    >
      {children}
    </GoogleAuthContext.Provider>
  );
}
