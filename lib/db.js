// Единый клиент Supabase. Ключи — только из окружения (.env / GitHub Secrets).
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Нет SUPABASE_URL / SUPABASE_SERVICE_KEY в окружении');
}

export const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});
