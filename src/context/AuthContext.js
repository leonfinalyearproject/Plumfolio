import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session on load — DON'T sign out
    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          await fetchProfileById(session.user.id);
        }
      } catch (error) {
        console.error('Session init error:', error);
      } finally {
        setLoading(false);
      }
    };

    initSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth event:', event);

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          setUser(session.user);
          await fetchProfileById(session.user.id);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch profile using plain select (avoids 406 errors)
  const fetchProfileById = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId);

      if (error) {
        console.error('Profile fetch error:', error);
        setProfile(null);
        return;
      }

      if (data && data.length > 0) {
        setProfile(data[0]);
      } else {
        setProfile(null);
      }
    } catch (error) {
      console.error('Profile fetch exception:', error);
      setProfile(null);
    }
  };

  // Public fetchProfile (for external use)
  const fetchProfile = useCallback(async (userId) => {
    await fetchProfileById(userId);
  }, []);

  // FR-1.1: Register
  const signUp = async (email, password, fullName) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  };

  // FR-1.2: Sign in
  const signIn = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data?.user) {
        setUser(data.user);
        await fetchProfileById(data.user.id);
      }
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  };

  // FR-1.3: Sign out
  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      if (error) throw error;
      return { error: null };
    } catch (error) {
      setUser(null);
      setProfile(null);
      return { error };
    }
  };

  // Update profile — optimistic update + DB sync
  const updateProfile = async (updates) => {
    if (!user) return { data: null, error: new Error('Not authenticated') };

    const previousProfile = profile;
    const optimistic = { ...(profile || { id: user.id }), ...updates };

    // Instant UI update
    setProfile(optimistic);

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (updateError) {
        console.error('DB update failed:', updateError);
        setProfile(previousProfile);
        return { data: null, error: updateError };
      }

      // Fetch fresh to confirm
      const { data: rows } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id);

      if (rows && rows.length > 0) {
        setProfile(rows[0]);
        return { data: rows[0], error: null };
      }

      return { data: optimistic, error: null };
    } catch (error) {
      console.error('updateProfile exception:', error);
      setProfile(previousProfile);
      return { data: null, error };
    }
  };

  // Update password
  const updatePassword = async (newPassword) => {
    try {
      const { data, error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  };

  const value = {
    user,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    updateProfile,
    updatePassword,
    fetchProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
