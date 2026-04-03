import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const loadingRef = useRef(true);

  const stopLoading = () => {
    if (loadingRef.current) {
      loadingRef.current = false;
      setLoading(false);
    }
  };

  const fetchProfileById = async (userId) => {
    try {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId);
      if (data && data.length > 0) setProfile(data[0]);
    } catch (e) {
      // silent
    }
  };

  useEffect(() => {
    // HARD GUARANTEE: loading stops in 3 seconds no matter what
    const hardTimeout = setTimeout(stopLoading, 3000);

    // Try to get session
    const init = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data && data.session && data.session.user) {
          setUser(data.session.user);
          try {
            await fetchProfileById(data.session.user.id);
          } catch (e) {
            // profile fetch failed, that's ok
          }
        }
      } catch (e) {
        console.error('getSession error:', e);
      }
      stopLoading();
    };

    init();

    // Listen for future changes (login, logout, token refresh)
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth:', event);
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session && session.user) {
          setUser(session.user);
          await fetchProfileById(session.user.id);
        }
        stopLoading();
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        stopLoading();
      }
    });

    return () => {
      clearTimeout(hardTimeout);
      if (listener && listener.subscription) listener.subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = useCallback(async (userId) => {
    await fetchProfileById(userId);
  }, []);

  const signUp = async (email, password, fullName) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email, password, options: { data: { full_name: fullName } },
      });
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  };

  const signIn = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data && data.user) {
        setUser(data.user);
        await fetchProfileById(data.user.id);
      }
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  };

  const signOut = async () => {
    try { await supabase.auth.signOut(); } catch (e) { /* ok */ }
    setUser(null);
    setProfile(null);
    return { error: null };
  };

  const updateProfile = async (updates) => {
    if (!user) return { data: null, error: new Error('Not logged in') };
    const prev = profile;
    setProfile({ ...(profile || { id: user.id }), ...updates });
    try {
      const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
      if (error) { setProfile(prev); return { data: null, error }; }
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id);
      if (data && data.length > 0) { setProfile(data[0]); return { data: data[0], error: null }; }
      return { data: { ...prev, ...updates }, error: null };
    } catch (error) {
      setProfile(prev);
      return { data: null, error };
    }
  };

  const updatePassword = async (newPassword) => {
    try {
      const { data, error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  };

  return (
    <AuthContext.Provider value={{
      user, profile, loading,
      signUp, signIn, signOut,
      updateProfile, updatePassword, fetchProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
