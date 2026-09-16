# Auth emails

Supabase sends these, not the app, so they are pasted into the dashboard rather
than deployed. Kept here so they are in version control and so the wording can
be reviewed alongside the rest of the app's copy.

## 1. Send through your own domain

**Project Settings -> Authentication -> SMTP Settings**, turn on custom SMTP:

| Field | Value |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | your Resend API key, the same one the Edge Function uses |
| Sender email | `hello@dukakonnect.co.ke` |
| Sender name | `DukaKonnect` |

This does more than change the name on the envelope. Supabase's built-in sender
is a shared one, throttled to a few messages an hour and documented as unfit for
production. It also appends "powered by Supabase" and an opt-out link to every
message, which on a password reset reads like a newsletter somebody can
unsubscribe from.

## 2. Replace the wording

**Authentication -> Email Templates**, then paste each file below into the
matching template. Supabase fills in `{{ .ConfirmationURL }}` and `{{ .Token }}`.

| File | Template |
|---|---|
| `reset-password.html` | Reset Password |
| `confirm-signup.html` | Confirm signup |

`confirm-signup.html` is not used yet: signup currently creates a session
immediately. It is here ready for the day email confirmation is turned on, which
the shop-creation refactor made safe to do.
