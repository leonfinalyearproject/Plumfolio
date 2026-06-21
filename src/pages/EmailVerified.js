import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './Auth.css';

/**
 * EmailVerified Component
 * Handles the email verification when user clicks the link from their email.
 * Supabase sends token_hash and type as URL params.
 * This page verifies the token and shows success/error.
 */
const EmailVerified = () => {
  const [status, setStatus] = useState('verifying'); // 'verifying', 'success', 'error'
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        // Get params from URL
        const queryParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.substring(1));

        const tokenHash = queryParams.get('token_hash') || hashParams.get('token_hash');
        const type = queryParams.get('type') || hashParams.get('type');
        const error = queryParams.get('error') || hashParams.get('error');
        const errorDescription = queryParams.get('error_description') || hashParams.get('error_description');

        // Check for error params first
        if (error) {
          setStatus('error');
          setErrorMessage(errorDescription || 'Verification failed. Please try again.');
          return;
        }

        // If we have a token, verify it
        if (tokenHash && type) {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type,
          });

          if (verifyError) {
            setStatus('error');
            setErrorMessage(verifyError.message || 'Verification failed. The link may have expired.');
          } else {
            // Sign out after verification so user can sign in fresh
            await supabase.auth.signOut();
            setStatus('success');
          }
        } else {
          // No token in URL — check if there's an access_token (older Supabase redirect)
          const accessToken = hashParams.get('access_token');
          if (accessToken) {
            setStatus('success');
          } else {
            setStatus('error');
            setErrorMessage('No verification token found. Please try clicking the link in your email again.');
          }
        }
      } catch (err) {
        console.error('Verification error:', err);
        setStatus('error');
        setErrorMessage('Something went wrong. Please try again.');
      }
    };

    verifyEmail();
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
        <a href={`${process.env.PUBLIC_URL}/`} className="auth-logo-link">
          <img src={`${process.env.PUBLIC_URL}/logo.png`} alt="Plumfolio" className="auth-logo" />
        </a>
        
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
              <p className="verification-note">You can now close this page and sign in to your account.</p>
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
