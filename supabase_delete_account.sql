-- Run this in your Supabase Dashboard → SQL Editor → New Query → Run
-- This creates a function that allows a signed-in user to fully delete
-- their own account from auth.users (and cascades to all linked data).

CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  -- Delete app data first (in case RLS or foreign keys block auth deletion)
  DELETE FROM public.transactions   WHERE user_id = auth.uid();
  DELETE FROM public.budgets        WHERE user_id = auth.uid();
  DELETE FROM public.savings_goals  WHERE user_id = auth.uid();
  DELETE FROM public.scan_usage     WHERE user_id = auth.uid();
  DELETE FROM public.profiles       WHERE id      = auth.uid();

  -- Delete the actual auth user — this is the line that requires SECURITY DEFINER
  DELETE FROM auth.users            WHERE id      = auth.uid();
$$;

-- Allow any authenticated user to call this function (they can only delete themselves)
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;
