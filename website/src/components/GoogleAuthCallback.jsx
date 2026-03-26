import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from './Navbar';
import { parseGoogleAuthCallback, setSession } from '../utils/auth';
import { writeProfile } from '../utils/dataTools';
import './Auth.css';

function GoogleAuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const finalizeGoogleAuth = async () => {
      const result = await parseGoogleAuthCallback(window.location.hash);

      if (!isMounted) return;

      if (!result.ok) {
        setError(result.message || 'Google authentication failed');
        return;
      }

      const { user } = result;
      setSession(user, true);

      writeProfile(user.id || user.username, {
        username: user.username,
        name: user.name || user.username,
        email: user.email || '',
        photo: user.picture || ''
      });

      window.history.replaceState(null, '', '/auth/google/callback');
      navigate(user.role === 'admin' ? '/dashboard' : '/user', { replace: true });
    };

    finalizeGoogleAuth();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  return (
    <div className="authPage">
      <Navbar />
      <main className="authPage__main">
        <div className="authCard">
          <h1 className="authTitle">Google Sign-In</h1>
          {error ? (
            <>
              <div className="authError">{error}</div>
              <div className="authLink">
                <Link to="/login">Return to login</Link>
              </div>
            </>
          ) : (
            <p className="authCallbackText">Finishing your sign-in and redirecting your account...</p>
          )}
        </div>
      </main>
    </div>
  );
}

export default GoogleAuthCallback;