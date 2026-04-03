import React, { createContext, useContext, useState, useEffect } from 'react';
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
          fetchProfile(session.user.id);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch user profile — fixed to handle 406 errors
  const fetchProfile = async (userId) => {
    try {
      // Use maybeSingle() instead of single() to avoid 406 when no row exists
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        // Fallback: try without maybeSingle
        const { data: fallbackData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId);
        
        if (fallbackData && fallbackData.length > 0) {
          setProfile(fallbackData[0]);
          return;
        }
      }
      
      setProfile(data || null);
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
    }
  };

  // FR-1.1: Register
  const signUp = async (email, password, fullName) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
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
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      
      if (data?.user) {
        setUser(data.user);
        fetchProfile(data.user.id);
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
      return { error };
    }
  };

  // Update profile — optimistically updates state, then syncs with DB
  const updateProfile = async (updates) => {
    try {
      // Optimistically update local state immediately for instant UI feedback
      setProfile(prev => prev ? { ...prev, ...updates } : updates);

      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .maybeSingle();

      if (error) {
        // If select fails but update succeeded, try fetching fresh
        console.error('Profile update select error:', error);
        // Try update without select
        const { error: updateError } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', user.id);
        
        if (updateError) {
          // Revert optimistic update
          await fetchProfile(user.id);
          throw updateError;
        }
        // Update succeeded, keep optimistic state
        return { data: { ...profile, ...updates }, error: null };
      }

      if (data) {
        setProfile(data);
      }
      return { data: data || { ...profile, ...updates }, error: null };
    } catch (error) {
      return { data: null, error };
    }
  };

  // Update password
  const updatePassword = async (newPassword) => {
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
      });

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
