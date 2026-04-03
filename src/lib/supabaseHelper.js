// src/lib/supabaseHelper.js
// Gets a fresh user ID with a valid token before making queries.
// This fixes the stale token issue on page refresh.

import { supabase } from './supabase';

let cachedUserId = null;
let cacheTime = 0;
const CACHE_TTL = 30000; // 30 seconds

export async function getAuthUserId() {
  // Return cached if fresh
  if (cachedUserId && (Date.now() - cacheTime) < CACHE_TTL) {
    return cachedUserId;
  }

  try {
    // This forces the Supabase client to refresh its internal token
    const { data, error } = await supabase.auth.getUser();
    if (!error && data && data.user) {
      cachedUserId = data.user.id;
      cacheTime = Date.now();
      return data.user.id;
    }
  } catch (e) {
    // silent
  }

  // Fallback to session
  try {
    const { data } = await supabase.auth.getSession();
    if (data && data.session && data.session.user) {
      cachedUserId = data.session.user.id;
      cacheTime = Date.now();
      return data.session.user.id;
    }
  } catch (e) {
    // silent
  }

  return null;
}
