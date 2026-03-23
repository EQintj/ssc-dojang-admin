import { createClient } from "@supabase/supabase-js";

// 환경변수가 없어도 빌드가 터지지 않도록 fallback 처리 (개발/안내 권장)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://your-project-id.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "your-anon-key";

export const supabase = createClient(supabaseUrl, supabaseKey);
