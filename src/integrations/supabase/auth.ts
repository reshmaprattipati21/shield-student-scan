import { supabase } from "./client";

type SignInOptions = {
  redirect_uri?: string;
};

/**
 * OAuth sign-in via Supabase Auth.
 * Supports Google and Apple providers.
 */
export async function signInWithOAuth(
  provider: "google" | "apple",
  opts?: SignInOptions,
) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: opts?.redirect_uri ?? window.location.origin + "/",
    },
  });

  if (error) {
    return { error };
  }

  return { data };
}
