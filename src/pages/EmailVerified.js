import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, XCircle, Loader } from 'lucide-react';
import './Auth.css';

/**
 * EmailVerified Component
 * Displays after user clicks the email verification link
 * Supabase redirects here after successful email verification
 */
const EmailVerified = () => {
  const [status, setStatus] = useState('verifying'); // 'verifying', 'success', 'error'
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    // Check URL for error parameters (Supabase adds these if verification fails)
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const queryParams = new URLSearchParams(window.location.search);
    
    const error = hashParams.get('error') || queryParams.get('error');
    const errorDescription = hashParams.get('error_description') || queryParams.get('error_description');
    
    if (error) {
      setStatus('error');
      setErrorMessage(errorDescription || 'Verification failed. Please try again.');
    } else {
      // Small delay to show the verification process
      setTimeout(() => {
        setStatus('success');
      }, 1000);
    }
  }, []);

  return (
    <div className="auth-page verification-page">
      {/* Animated Spotlights Background */}
      <div className="spotlights">
        <div className="spotlight purple"></div>
        <div className="spotlight green"></div>
        <div className="spotlight purple-2"></div>
        <div className="spotlight green-2"></div>
      </div>
      
      <div className="auth-container">
        <Link to="/" className="auth-logo-link">
          <img src={`${process.env.PUBLIC_URL}/logo.png`} alt="Plumfolio" className="auth-logo" />
        </Link>
        
        <div className="auth-card verification-card">
          {status === 'verifying' && (
            <>
              <div className="verification-icon verifying">
                <Loader size={32} className="spin" />
              </div>
              <h2>Verifying your email...</h2>
              <p>Please wait a moment</p>
            </>
          )}
          
          {status === 'success' && (
            <>
              <div className="verification-icon success">
                <CheckCircle size={32} />
              </div>
              <h2>Email Verified!</h2>
              <p>Your email has been successfully verified.</p>
              <p className="verification-note">You can close this page now and sign in to your account.</p>
              <Link to="/signin" className="auth-btn verification-btn">
                Go to Sign In
              </Link>
            </>
          )}
          
          {status === 'error' && (
            <>
              <div className="verification-icon error">
                <XCircle size={32} />
              </div>
              <h2>Verification Failed</h2>
              <p>{errorMessage}</p>
              <p className="verification-note">The link may have expired or already been used.</p>
              <Link to="/signup" className="auth-btn verification-btn">
                Try Again
              </Link>
            </>
          )}
        </div>
        
        <footer className="auth-footer">
          <p>&copy; Plumfolio 2026</p>
        </footer>
      </div>
    </div>
  );
};

export default EmailVerified;
