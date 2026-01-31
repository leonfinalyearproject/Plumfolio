import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ArrowRight } from 'lucide-react';
import './Landing.css';

const Landing = () => {
  const [showIntro, setShowIntro] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
      return;
    }

    // Start fade out after 2.5 seconds
    const fadeTimer = setTimeout(() => setFadeOut(true), 2500);
    
    // Hide intro after fade completes
    const hideTimer = setTimeout(() => setShowIntro(false), 3200);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, [user, navigate]);

  if (showIntro) {
    return (
      <div className={`intro-container ${fadeOut ? 'fade-out' : ''}`}>
        <div className="intro-logo-wrapper">
          <img 
            src={`${process.env.PUBLIC_URL}/logo.png`} 
            alt="Plumfolio" 
            className="intro-logo"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="landing">
      <div className="landing-content">
        <img 
          src={`${process.env.PUBLIC_URL}/logo.png`} 
          alt="Plumfolio" 
          className="landing-logo"
        />
        
        <p className="landing-tagline">
          Your personal finance companion
        </p>

        <div className="landing-actions">
          <button onClick={() => navigate('/signup')} className="btn-primary">
            Get Started
            <ArrowRight size={18} />
          </button>
          <button onClick={() => navigate('/signin')} className="btn-secondary">
            Sign In
          </button>
        </div>

        <p className="landing-footer">
          Final Year Project by Leon Maunge<br />
          University of Botswana
        </p>
      </div>
    </div>
  );
};

export default Landing;
