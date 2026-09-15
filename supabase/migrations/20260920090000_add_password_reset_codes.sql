-- A way back in for an owner who has forgotten their password.
--
-- Staff have had one since August: the owner sets them a temporary password
-- from the Staff screen. An owner has nobody above them, and a phone login has
-- no inbox to send a reset link to, because `254712345678@duka.local` is a
-- synthetic address invented so Supabase would accept a phone number. Until now
-- the answer has been "contact us and we will do it by hand in the dashboard",
-- which works while there are five shops and not at all after that.
--
-- Recovery only, never sign-in. Passwords remain the way in. This exists solely
-- for the case where somebody cannot remember theirs, which is why a code costs
-- money once a year rather than once a day.

CREATE TABLE IF NOT EXISTS public.password_reset_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  -- Normalised to 2547XXXXXXXX before it ever gets here, so the rate limit
  -- cannot be sidestepped by typing the same number three different ways.
  phone TEXT NOT NULL,
  -- A keyed hash, never the code itself. Same reasoning as a password: reading
  -- this table must not hand somebody a working reset. Plain SHA-256 would not
  -- be enough on its own -- six digits is a million guesses, which is seconds
  -- of offline work -- so the Edge Function HMACs it with a secret that lives
  -- only in the environment and never in the database.
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The rate limit reads this on every request, keyed on phone and recency.
CREATE INDEX IF NOT EXISTS password_reset_codes_phone_idx
  ON public.password_reset_codes (phone, created_at DESC);

/*
 * Row level security with no policies at all, which is the point.
 *
 * RLS on and nothing granted means every client request returns nothing, from
 * anon and authenticated alike. Only the service role reaches it, and the only
 * things holding the service role are the two Edge Functions. A reset code is
 * the one row in this database that must never be readable by the person it
 * belongs to.
 */
ALTER TABLE public.password_reset_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.password_reset_codes FROM anon, authenticated;

/*
 * Forget old codes.
 *
 * Nothing needs them after a day: they have either been used, expired, or were
 * never going to be. Keeping them would mean keeping a growing list of which
 * phone numbers belong to DukaKonnect owners, which is exactly the kind of
 * thing worth not having if this table is ever read by somebody it shouldn't be.
 *
 * Called by the request function rather than scheduled, because a table that is
 * only written when somebody forgets a password does not need a cron job.
 */
CREATE OR REPLACE FUNCTION public.purge_old_reset_codes()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.password_reset_codes
  WHERE created_at < now() - INTERVAL '1 day';
$$;

REVOKE ALL ON FUNCTION public.purge_old_reset_codes() FROM anon, authenticated;
