// Supabase Auth requires an email under the hood. Since this app wants
// username+password only (no real email), we deterministically map a
// normalized username to a fake internal address. This keeps signup/login
// simple for users while still using Supabase's built-in auth system.
//
// IMPORTANT: for this to work, "Confirm email" must be turned OFF in
// Supabase → Authentication → Providers → Email, since these fake
// addresses can never receive a real confirmation email.

const FAKE_EMAIL_DOMAIN = "noemail.quizclub.internal";

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidUsername(username: string): boolean {
  return /^[a-z0-9_]{3,20}$/.test(username);
}

export function usernameToEmail(username: string): string {
  return `${normalizeUsername(username)}@${FAKE_EMAIL_DOMAIN}`;
}
