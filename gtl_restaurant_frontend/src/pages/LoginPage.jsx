import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../config/api';
import { useUser, createUserModel } from '../context/UserContext';
import logo from '../assets/images/logo.png';

const validateEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const validateLogin = (form) => {
  const e = {};
  if (!form.user_id.trim()) e.user_id = 'User ID is required.';
  else if (form.user_id.trim().length < 3) e.user_id = 'User ID must be at least 3 characters.';
  return e;
};
const validateRegister = (form) => {
  const e = {};
  if (!form.user_id.trim()) e.user_id = 'User ID is required.';
  else if (form.user_id.trim().length < 3) e.user_id = 'User ID must be at least 3 characters.';
  if (!form.email.trim()) e.email = 'Email is required.';
  else if (!validateEmail(form.email.trim())) e.email = 'Enter a valid email address.';
  if (!form.password.trim()) e.password = 'Password is required.';
  else if (form.password.trim().length < 6) e.password = 'Password must be at least 6 characters.';
  return e;
};

const LoginPage = () => {
  const navigate = useNavigate();
  const { setUser } = useUser();
  const [mode, setMode] = useState('login');
  const [flash, setFlash] = useState(null);
  const [loginForm, setLoginForm] = useState({ user_id: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ user_id: '', email: '', password: '' });
  const [loginErrors, setLoginErrors] = useState({});
  const [registerErrors, setRegisterErrors] = useState({});
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const isLoginMode = mode === 'login';

  const handleLoginFieldChange = (e) => {
    const updated = { ...loginForm, [e.target.name]: e.target.value };
    setLoginForm(updated);
    setLoginErrors(validateLogin(updated));
  };
  const handleRegisterFieldChange = (e) => {
    const updated = { ...registerForm, [e.target.name]: e.target.value };
    setRegisterForm(updated);
    setRegisterErrors(validateRegister(updated));
  };

  const submitForm = async (endpoint, payload, successMessage, onSuccess) => {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(payload),
        credentials: 'include',
      });
      let body = null;
      try {
        body = await response.json();
      } catch (error) {
        body = null;
      }
      if (response.ok) {
        try {
          setFlash({ type: 'success', message: successMessage });
          onSuccess(body);
        } catch (error) {
          console.error('Login flow error:', error);
          setFlash({ type: 'error', message: error?.message || 'Login succeeded, but redirect failed.' });
        }
      } else {
        setFlash({ type: 'error', message: body?.message || 'Invalid credentials or registration failed.' });
      }
    } catch (error) {
      console.error('Request failed:', error);
      const isBackendUnavailable =
        error instanceof TypeError &&
        String(error?.message || '').toLowerCase().includes('fetch');
      setFlash({
        type: 'error',
        message: isBackendUnavailable
          ? `Cannot reach the backend at ${API_BASE}. Start the Flask server and try again.`
          : error?.message || 'Network error. Please try again later.',
      });
    }
  };

  const handleLogin = (event) => {
    event.preventDefault();
    submitForm('/login', loginForm, 'Logged in successfully.', (body) => {
      if (body?.data?.mfa_required) {
        window.location.assign(`/verify-mfa?token=${encodeURIComponent(body?.data?.otp_token ?? '')}&expires_in=${encodeURIComponent(body?.data?.expires_in ?? '')}`);
        return;
      }
      const userPayload = body?.data?.user ?? loginForm.user_id;
      const role = body?.data?.user?.role ?? '';
      setUser(createUserModel(userPayload));
      if (role === 'admin' || role === 'staff') {
        localStorage.setItem('gtl_admin_auth', 'true');
        window.location.assign('/admin');
      } else {
        localStorage.removeItem('gtl_admin_auth');
        window.location.assign('/home');
      }
    });
  };

  const handleRegister = (event) => {
    event.preventDefault();
    const errors = validateRegister(registerForm);
    setRegisterErrors(errors);
    if (Object.values(errors).some(Boolean)) { setFlash({ type: 'error', message: 'Fix the highlighted fields.' }); return; }
    submitForm('/register', registerForm, 'Registered! Check your email for a 6-digit code.', (body) => {
      if (body?.data?.mfa_required) {
        window.location.assign(`/verify-mfa?token=${encodeURIComponent(body?.data?.otp_token ?? '')}&expires_in=${encodeURIComponent(body?.data?.expires_in ?? '')}`);
      } else { setMode('login'); }
    });
  };

  return (
    <div className="login-page">
      <div className="login-overlay">
        <div className="login-card">
          <div className="text-center mb-3">
            <img src={logo} className="logo-circle" alt="GTL Logo" />
          </div>
          {flash && <div className={`flash ${flash.type}`}>{flash.message}</div>}
          <div className="toggle-buttons">
            <button className={isLoginMode ? 'active' : ''} onClick={() => setMode('login')}><i className="fa fa-right-to-bracket"></i> Log In</button>
            <button className={!isLoginMode ? 'active' : ''} onClick={() => setMode('register')}><i className="fa fa-user-plus"></i> Register</button>
          </div>
          <a href={`${API_BASE}/google-login`} className="google-btn">
            <img src="https://developers.google.com/identity/images/g-logo.png" alt="Google" />
            Continue with Google
          </a>
          {isLoginMode ? (
            <form id="loginForm" onSubmit={handleLogin}>
              <input type="text" name="user_id" placeholder="User Id" value={loginForm.user_id} onChange={handleLoginFieldChange} required />
              {loginErrors.user_id && <small className="input-error">{loginErrors.user_id}</small>}
              <div className="password-field">
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="Enter Password"
                  value={loginForm.password}
                  onChange={handleLoginFieldChange}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowLoginPassword((value) => !value)}
                  aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                >
                  <i className={`fa ${showLoginPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
              <button type="submit" className="gradient-btn w-100"><i className="fa fa-right-to-bracket"></i> Log In</button>
            </form>
          ) : (
            <form id="registerForm" onSubmit={handleRegister}>
              <input type="text" name="user_id" placeholder="User Id" value={registerForm.user_id} onChange={handleRegisterFieldChange} required />
              {registerErrors.user_id && <small className="input-error">{registerErrors.user_id}</small>}
              <input type="email" name="email" placeholder="Email Id" value={registerForm.email} onChange={handleRegisterFieldChange} required />
              {registerErrors.email && <small className="input-error">{registerErrors.email}</small>}
              <div className="password-field">
                <input
                  type={showRegisterPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="Enter Password"
                  value={registerForm.password}
                  onChange={handleRegisterFieldChange}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowRegisterPassword((value) => !value)}
                  aria-label={showRegisterPassword ? 'Hide password' : 'Show password'}
                >
                  <i className={`fa ${showRegisterPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
              {registerErrors.password && <small className="input-error">{registerErrors.password}</small>}
              <button type="submit" className="gradient-btn w-100"><i className="fa fa-user-plus"></i> Register</button>
            </form>
          )}
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <a href="/setup-mfa" style={{ fontSize: '0.8rem', color: '#888', textDecoration: 'none' }}>
              <i className="fa fa-shield-halved"></i> Setup Two-Factor Authentication
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
