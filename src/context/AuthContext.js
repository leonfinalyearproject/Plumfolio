import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const clearSessionOnLoad = async () => {
      try {
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
      } catch (error) {
        console.error('Error clearing session:', error);
      } finally {
        setLoading(false);
      }
    };

    clearSessionOnLoad();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth event:', event);

      if (event === 'SIGNED_IN') {
        if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = useCallback(async (userId) => {
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
        console.log('Profile loaded:', data[0]);
        setProfile(data[0]);
      } else {
        console.log('No profile row found');
        setProfile(null);
      }
    } catch (error) {
      console.error('Profile fetch exception:', error);
      setProfile(null);
    }
  }, []);

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

  const signIn = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data?.user) {
        setUser(data.user);
        await fetchProfile(data.user.id);
      }
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const updateProfile = async (updates) => {
    if (!user) return { data: null, error: new Error('Not authenticated') };

    const previousProfile = profile;
    const optimistic = { ...(profile || { id: user.id }), ...updates };
    
    // Instant UI update
    setProfile(optimistic);
    console.log('Optimistic profile set:', optimistic);

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

      console.log('DB update succeeded for:', updates);

      // Fetch fresh to confirm
      const { data: rows } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id);

      if (rows && rows.length > 0) {
        console.log('Fresh profile:', rows[0]);
        setProfile(rows[0]);
        return { data: rows[0], error: null };
      }

      // Keep optimistic if fetch fails
      return { data: optimistic, error: null };
    } catch (error) {
      console.error('updateProfile exception:', error);
      setProfile(previousProfile);
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
