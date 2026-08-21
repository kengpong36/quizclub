"use client";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// A missing/placeholder config won't crash the build — it will just
// fail requests at runtime with a clear error, which is fine for local dev.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
