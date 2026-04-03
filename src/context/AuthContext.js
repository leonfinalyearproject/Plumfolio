import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const doneRef = useRef(false);

  const done = () => {
    if (!doneRef.current) {
      doneRef.current = true;
      setLoading(false);
    }
  };

  const fetchProfileById = async (userId) => {
    try {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId);
      if (data && data.length > 0) setProfile(data[0]);
    } catch (e) { /* silent */ }
  };

  useEffect(() => {
    // Hard timeout — loading WILL stop in 4 seconds no matter what
    const timeout = setTimeout(done, 4000);

    const init = async () => {
      try {
        // Step 1: Get existing session
        const { data: sessionData } = await supabase.auth.getSession();
        
        if (sessionData?.session) {
          // Step 2: Force token refresh with getUser()
          // This ensures the JWT is fresh so RLS queries return data
          const { data: userData } = await supabase.auth.getUser();
          
          if (userData?.user) {
            setUser(userData.user);
            await fetchProfileById(userData.user.id);
          } else {
            // getUser failed but session exists — use session user
            setUser(sessionData.session.user);
            await fetchProfileById(sessionData.session.user.id);
          }
        }
      } catch (e) {
        console.error('Auth init error:', e);
      }
      done();
    };

    init();

    // Listen for future auth events (sign in, sign out, token refresh)
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth:', event);
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session?.user) {
            setUser(session.user);
            await fetchProfileById(session.user.id);
          }
          done();
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
          done();
        }
      }
    );

    return () => {
      clearTimeout(timeout);
      if (listener?.subscription) listener.subscription.unsubscribe();
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
