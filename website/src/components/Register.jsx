import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Navbar from './Navbar';
// Footer intentionally omitted on non-home pages.
import {
  registerUser,
  isGoogleAuthAvailable,
  startGoogleLogin,
  setSession
} from '../utils/auth';
import { writeProfile } from '../utils/dataTools';
import './Auth.css';

function Register() {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    name: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: ''
  });
  const [errors, setErrors] = useState({});
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
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (errors[name] || errors.general) {
      setErrors({ ...errors, [name]: '', general: '' });
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.username) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }

    if (!formData.name.trim()) newErrors.name = 'Full name is required';
    if (!formData.phone.trim()) newErrors.phone = 'Phone number is required';
    else if (!/^\+?[\d\s-]{7,15}$/.test(formData.phone)) {
      newErrors.phone = 'Enter a valid phone number';
    }
    if (!formData.address.trim()) newErrors.address = 'Address is required';
    if (!formData.city.trim()) newErrors.city = 'City is required';
    if (!formData.state.trim()) newErrors.state = 'State is required';
    if (!formData.pincode.trim()) newErrors.pincode = 'Pincode is required';
    else if (!/^\d{5,6}$/.test(formData.pincode)) {
      newErrors.pincode = 'Enter a valid pincode';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const result = await registerUser({ 
        username: formData.username, 
        password: formData.password 
      });
      
      if (!result.ok) {
        setErrors({ general: result.message || 'Unable to register' });
        setIsLoading(false);
        return;
      }

      // Save user profile for later use
      const profile = {
        name: formData.name.trim(),
        username: formData.username.trim(),
        phone: formData.phone.trim(),
        address: formData.address.trim(),
        city: formData.city.trim(),
        state: formData.state.trim(),
        pincode: formData.pincode.trim()
      };
      const userId = formData.username.trim();
      writeProfile(userId, profile);

      setIsLoading(false);
      navigate('/login');
    } catch {
      setErrors({ general: 'Network error. Please try again.' });
      setIsLoading(false);
    }
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
          <h1 className="authTitle">Register</h1>
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
                placeholder="Choose a unique username"
              />
              {errors.username && <span className="authHelper authHelper--error">{errors.username}</span>}
            </label>

            <label className="authField">
              <span className="authLabel">Full Name</span>
              <input
                className={`authInput ${errors.name ? 'authInput--error' : ''}`}
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Your full name"
              />
              {errors.name && <span className="authHelper authHelper--error">{errors.name}</span>}
            </label>

            <label className="authField">
              <span className="authLabel">Phone Number</span>
              <input
                className={`authInput ${errors.phone ? 'authInput--error' : ''}`}
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="Your phone number"
              />
              {errors.phone && <span className="authHelper authHelper--error">{errors.phone}</span>}
            </label>

            <label className="authField">
              <span className="authLabel">Address</span>
              <input
                className={`authInput ${errors.address ? 'authInput--error' : ''}`}
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Street address"
              />
              {errors.address && <span className="authHelper authHelper--error">{errors.address}</span>}
            </label>

            <label className="authField">
              <span className="authLabel">City</span>
              <input
                className={`authInput ${errors.city ? 'authInput--error' : ''}`}
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="City"
              />
              {errors.city && <span className="authHelper authHelper--error">{errors.city}</span>}
            </label>

            <label className="authField">
              <span className="authLabel">State</span>
              <input
                className={`authInput ${errors.state ? 'authInput--error' : ''}`}
                type="text"
                name="state"
                value={formData.state}
                onChange={handleChange}
                placeholder="State"
              />
              {errors.state && <span className="authHelper authHelper--error">{errors.state}</span>}
            </label>

            <label className="authField">
              <span className="authLabel">Pincode</span>
              <input
                className={`authInput ${errors.pincode ? 'authInput--error' : ''}`}
                type="text"
                name="pincode"
                value={formData.pincode}
                onChange={handleChange}
                placeholder="5-6 digit pincode"
              />
              {errors.pincode && <span className="authHelper authHelper--error">{errors.pincode}</span>}
            </label>

            <label className="authField">
              <span className="authLabel">Password</span>
              <input
                className={`authInput ${errors.password ? 'authInput--error' : ''}`}
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="At least 6 characters"
              />
              {errors.password && <span className="authHelper authHelper--error">{errors.password}</span>}
            </label>

            <label className="authField">
              <span className="authLabel">Confirm Password</span>
              <input
                className={`authInput ${errors.confirmPassword ? 'authInput--error' : ''}`}
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Re-enter your password"
              />
              {errors.confirmPassword && (
                <span className="authHelper authHelper--error">{errors.confirmPassword}</span>
              )}
            </label>

            <button type="submit" className="authSubmit" disabled={isLoading}>
              {isLoading ? 'Registering...' : 'Register'}
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
            <Link to="/login">Already have an account? Login</Link>
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

export default Register;
