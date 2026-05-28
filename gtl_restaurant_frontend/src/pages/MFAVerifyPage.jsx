import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../config/api';
import { createUserModel, useUser } from '../context/UserContext';

const MFAVerifyPage = () => {
  const navigate = useNavigate();
  const { setUser } = useUser();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const search = useMemo(() => new URLSearchParams(window.location.search), []);
  const otpToken = search.get('token') ?? '';
  const expiresFromQuery = Number(search.get('expires_in') ?? '120');
  const expiresInSeconds = Number.isFinite(expiresFromQuery) && expiresFromQuery > 0 ? expiresFromQuery : 120;

  const [timer, setTimer] = useState(expiresInSeconds);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [flash, setFlash] = useState(null);
  const digitRefs = useRef([]);

  useEffect(() => {
    digitRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    setTimer(expiresInSeconds);
    const interval = setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresInSeconds, otpToken]);

  const isComplete = otp.filter((digit) => digit).length === 6;

  const updateOtpDigit = (value, index) => {
    const sanitized = value.replace(/\D/g, '').slice(0, 1);
    setOtp((prev) => {
      const next = [...prev];
      next[index] = sanitized;
      return next;
    });
    if (sanitized && index < 5) {
      digitRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (event, index) => {
    if (event.key === 'Backspace' && !otp[index] && index > 0) {
      const prevIndex = index - 1;
      digitRefs.current[prevIndex]?.focus();
      setOtp((prev) => {
        const next = [...prev];
        next[prevIndex] = '';
        return next;
      });
    }
  };

  const handlePaste = (event) => {
    const paste = (event.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
    if (paste.length === 6) {
      const digits = paste.split('');
      setOtp(digits);
      digitRefs.current[5]?.focus();
      event.preventDefault();
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!isComplete) return;
    if (!otpToken) {
      setFlash({ type: 'error', message: 'Missing OTP token. Please restart login.' });
      return;
    }
    const code = otp.join('');
    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/verify-mfa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ otp: code, otp_token: otpToken }),
        credentials: 'include',
      });
      if (response.ok) {
        let body = null;
        try {
          body = await response.json();
        } catch (error) {
          body = null;
        }

        const payload =
          body?.data?.user ?? body?.data?.user_id ?? body?.data?.id ?? body?.data?.email ?? null;
        if (payload) {
          setUser(createUserModel(payload));
        } else {
          try {
            const res = await fetch(`${API_BASE}/home`, { credentials: 'include' });
            if (res.ok) {
              const homeBody = await res.json();
              const homePayload = homeBody?.data?.user ?? null;
              if (homePayload) {
                setUser(createUserModel(homePayload));
              }
            }
          } catch (error) {
            // Fallback to navigation; user context can remain null.
          }
        }

        // Navigate immediately so the OTP token isn't left in the URL/history.
        navigate('/home', { replace: true });
      } else {
        setFlash({ type: 'error', message: 'Invalid or expired code. Please try again.' });
      }
    } catch (error) {
      setFlash({ type: 'error', message: 'Unable to verify. Check your connection and try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card mfa-card">
        <div className="mfa-icon">🛡️</div>
        <h1 className="auth-title">Verify Identity</h1>
        <p className="auth-subtitle">Enter the 6-digit code sent to your email</p>

        {flash && <div className={`flash ${flash.type}`}>{flash.message}</div>}

        <form id="mfaForm" onSubmit={handleSubmit}>
          <div className="otp-input-group" id="otpGroup">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <input
                key={index}
                type="text"
                className="otp-digit"
                maxLength="1"
                inputMode="numeric"
                pattern="[0-9]"
                value={otp[index]}
                ref={(el) => (digitRefs.current[index] = el)}
                onChange={(event) => updateOtpDigit(event.target.value, index)}
                onKeyDown={(event) => handleKeyDown(event, index)}
                onPaste={index === 0 ? handlePaste : undefined}
              />
            ))}
          </div>

          <div className="otp-timer" id="timerBox">
            <i className="fa fa-clock me-1"></i>
            Code expires in <span id="timer">{timer}</span>s
          </div>

          <button type="submit" className="btn-gold form-btn" id="verifyBtn" disabled={!isComplete || isSubmitting}>
            {isSubmitting ? (
              <>
                <span className="spinner"></span> Verifying...
              </>
            ) : (
              <>
                <i className="fa fa-shield-halved me-2"></i>Verify Code
              </>
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <a href="/login" style={{ fontSize: '0.8rem', color: '#888', textDecoration: 'none' }}>
            <i className="fa fa-arrow-left me-1"></i>Back to Login
          </a>
        </div>
      </div>
    </div>
  );
};

export default MFAVerifyPage;
