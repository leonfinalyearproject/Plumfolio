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
      const { data, error } = await supabase
        .from('profiles').select('*').eq('id', userId);
      if (!error && data && data.length > 0) setProfile(data[0]);
      else setProfile(null);
    } catch (e) { setProfile(null); }
  };

  useEffect(() => {
    // Safety timeout — if auth check takes longer than 5s, stop loading
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 5000);

    // Use ONLY onAuthStateChange — it fires INITIAL_SESSION on mount
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth event:', event, session?.user?.email || 'no user');

        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session?.user) {
            setUser(session.user);
            await fetchProfileById(session.user.id);
          } else {
            setUser(null);
            setProfile(null);
          }
          clearTimeout(timeout);
          setLoading(false);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
          clearTimeout(timeout);
          setLoading(false);
        }
      }
    );

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
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
    setUser(null);
    setProfile(null);
    return { error: null };
  };

  const updateProfile = async (updates) => {
    if (!user) return { data: null, error: new Error('Not authenticated') };
    const prev = profile;
    setProfile({ ...(profile || { id: user.id }), ...updates });
    try {
      const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
      if (error) { setProfile(prev); return { data: null, error }; }
      const { data: rows } = await supabase.from('profiles').select('*').eq('id', user.id);
      if (rows && rows.length > 0) { setProfile(rows[0]); return { data: rows[0], error: null }; }
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
