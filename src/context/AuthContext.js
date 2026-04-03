import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfileById = async (userId) => {
    try {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId);
      if (data && data.length > 0) setProfile(data[0]);
    } catch (e) { /* silent */ }
  };

  useEffect(() => {
    let mounted = true;
    const timeout = setTimeout(() => { if (mounted) setLoading(false); }, 5000);

    const init = async () => {
      try {
        // Step 1: Check if session exists
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          if (mounted) { setUser(null); setProfile(null); setLoading(false); }
          return;
        }

        // Step 2: Force token refresh — this is critical for RLS
        const { data: { user: freshUser }, error } = await supabase.auth.getUser();
        
        if (error || !freshUser) {
          // Token refresh failed — session is invalid
          if (mounted) { setUser(null); setProfile(null); setLoading(false); }
          return;
        }

        // Step 3: NOW set the user — token is guaranteed fresh at this point
        if (mounted) {
          setUser(freshUser);
          await fetchProfileById(freshUser.id);
          setLoading(false);
        }
      } catch (e) {
        console.error('Auth init error:', e);
        if (mounted) setLoading(false);
      }
    };

    init();

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      console.log('Auth:', event);
      
      if (event === 'SIGNED_IN') {
        if (session?.user) {
          setUser(session.user);
          await fetchProfileById(session.user.id);
        }
        setLoading(false);
      } else if (event === 'TOKEN_REFRESHED') {
        if (session?.user) setUser(session.user);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(timeout);
      if (listener?.subscription) listener.subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = useCallback(async (userId) => { await fetchProfileById(userId); }, []);

  const signUp = async (email, password, fullName) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email, password, options: { data: { full_name: fullName } },
      });
      if (error) throw error;
      return { data, error: null };
    } catch (error) { return { data: null, error }; }
  };

  const signIn = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data?.user) {
        setUser(data.user);
        await fetchProfileById(data.user.id);
      }
      return { data, error: null };
    } catch (error) { return { data: null, error }; }
  };

  const signOut = async () => {
    try { await supabase.auth.signOut(); } catch (e) { /* ok */ }
    setUser(null); setProfile(null);
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
    } catch (error) { setProfile(prev); return { data: null, error }; }
  };

  const updatePassword = async (newPassword) => {
    try {
      const { data, error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      return { data, error: null };
    } catch (error) { return { data: null, error }; }
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
