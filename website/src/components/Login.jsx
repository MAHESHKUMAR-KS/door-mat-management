import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from './Navbar';
// Footer intentionally omitted on non-home pages.
import {
  authenticateUser,
  isGoogleAuthAvailable,
  startGoogleLogin,
  setSession
} from '../utils/auth';
import './Auth.css';

function Login() {
  const [formData, setFormData] = useState({ username: '', password: '', rememberMe: false });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [googleUnavailable, setGoogleUnavailable] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    const checkGoogleAvailability = async () => {
      const available = await isGoogleAuthAvailable();
      if (isMounted) {
        setGoogleUnavailable(!available);
      }
    };

    checkGoogleAvailability();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({ ...formData, [name]: type === 'checkbox' ? checked : value });
    // Clear errors on change
    if (errors[name] || errors.general) {
      setErrors({ ...errors, [name]: '', general: '' });
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.username) {
      newErrors.username = 'Username is required';
    }
    if (!formData.password) {
      newErrors.password = 'Password is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      // Call backend API for authentication
      const user = await authenticateUser({
        username: formData.username,
        password: formData.password
      });

      if (user) {
        // User authenticated - store session and redirect based on role
        setSession(user, formData.rememberMe);

        if (user.role === 'admin') {
          navigate('/dashboard');
        } else {
          navigate('/user');
        }
      } else {
        setErrors({ general: 'Invalid username or password' });
      }
    } catch {
      setErrors({ general: 'Network error. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleGoogleSignIn = async () => {
    if (googleUnavailable) {
      setErrors({ general: 'Google sign-in is not configured yet.' });
      return;
    }

    setErrors((prev) => ({ ...prev, general: '' }));
    setIsGoogleLoading(true);
    try {
      await startGoogleLogin();
    } catch (error) {
      setIsGoogleLoading(false);
      setErrors({
        general: error?.message || 'Unable to start Google sign-in. Ensure backend and Google OAuth settings are correct.'
      });
    }
  };

  return (
    <div className="authPage">
      <Navbar />
      <main className="authPage__main">
        <div className="authCard">
          <h1 className="authTitle">Login</h1>
          {errors.general && <div className="authError">{errors.general}</div>}
          <form className="authForm" onSubmit={handleSubmit}>
            <label className="authField">
              <span className="authLabel">Username</span>
              <input
                className={`authInput ${errors.username ? 'authInput--error' : ''}`}
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="Enter your username"
              />
              {errors.username && <span className="authHelper authHelper--error">{errors.username}</span>}
            </label>

            <label className="authField">
              <span className="authLabel">Password</span>
              <div className="authPassword">
                <input
                  className={`authInput ${errors.password ? 'authInput--error' : ''}`}
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                />
                <button type="button" onClick={togglePasswordVisibility} aria-label="Toggle password visibility">
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {errors.password && <span className="authHelper authHelper--error">{errors.password}</span>}
            </label>

            <label className="authRemember">
              <input
                type="checkbox"
                name="rememberMe"
                checked={formData.rememberMe}
                onChange={handleChange}
              />
              Remember me
            </label>

            <button type="submit" className="authSubmit" disabled={isLoading}>
              {isLoading ? 'Logging in...' : 'Login'}
            </button>

            <div className="authDivider" role="separator" aria-label="Or continue with Google">
              <span>or</span>
            </div>

            <div className="authGoogleWrap">
              <button
                type="button"
                className="authGoogleButton"
                onClick={handleGoogleSignIn}
                disabled={isGoogleLoading || googleUnavailable}
              >
                <GoogleIcon />
                <span>{isGoogleLoading ? 'Redirecting to Google...' : 'Continue with Google'}</span>
              </button>
              {googleUnavailable && (
                <span className="authHelper authHelper--error">
                  Google sign-in is unavailable. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
                  GOOGLE_REDIRECT_URI, FRONTEND_URL, and JWT_SECRET in backend/.env, then restart the backend.
                </span>
              )}
              {isGoogleLoading && <span className="authHelper">Redirecting to Google sign-in...</span>}
            </div>
          </form>
          <div className="authLink">
            <Link to="/register">New here? Register</Link>
          </div>
        </div>
      </main>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.8-6-6.2s2.7-6.2 6-6.2c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 2.9 14.7 2 12 2 6.9 2 2.8 6.3 2.8 11.5S6.9 21 12 21c6.9 0 9.1-4.9 9.1-7.5 0-.5-.1-.9-.1-1.3H12Z" />
      <path fill="#4285F4" d="M2.8 7.3l3.2 2.4C6.9 7.5 9.2 5.3 12 5.3c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 2.9 14.7 2 12 2 8 2 4.5 4.3 2.8 7.3Z" />
      <path fill="#FBBC05" d="M12 21c2.6 0 4.8-.9 6.4-2.5l-3-2.5c-.8.6-1.9 1-3.4 1-3.9 0-5.1-2.6-5.4-3.9l-3.3 2.5C5 18.8 8.2 21 12 21Z" />
      <path fill="#34A853" d="M2.8 15.7 6.1 13.2c.3 1.3 1.5 3.9 5.4 3.9 1.5 0 2.6-.4 3.4-1l3 2.5c-1.7 1.6-3.8 2.5-6.4 2.5-3.8 0-7-2.2-8.7-5.4Z" />
    </svg>
  );
}

export default Login;