import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    const getSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        // If there's an error getting session, clear everything
        if (error) {
          console.error('Session error:', error);
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id);
        } else {
          setUser(null);
          setProfile(null);
        }
      } catch (error) {
        console.error('Error getting session:', error);
        // On any error, clear state to allow fresh login
        setUser(null);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };

    getSession();

    // Listen for auth changes (handles token refresh, sign in, sign out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth event:', event);
      
      if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      if (event === 'TOKEN_REFRESHED') {
        console.log('Token refreshed successfully');
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id);
        }
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch user profile from profiles table
  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        // If we can't fetch profile due to auth error, sign out
        if (error.code === 'PGRST301' || error.message?.includes('JWT')) {
          console.error('Auth error fetching profile, signing out');
          await supabase.auth.signOut();
          setUser(null);
          setProfile(null);
          return;
        }
        
        if (error.code !== 'PGRST116') {
          console.error('Error fetching profile:', error);
        }
      }
      
      setProfile(data || null);
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
    }
  };

  // FR-1.1: The system shall allow a new user to register with an email and password
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

  // FR-1.2: The system shall allow a registered user to log in
  const signIn = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  };

  // FR-1.3: The system shall allow a logged-in user to log out
  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      setUser(null);
      setProfile(null);
      
      return { error: null };
    } catch (error) {
      // Even if signOut fails, clear local state
      setUser(null);
      setProfile(null);
      return { error };
    }
  };

  // Update profile
  const updateProfile = async (updates) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;
      
      setProfile(data);
      
      return { data, error: null };
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
