import { createClient } from '@supabase/supabase-js';

export const testSupabase = () => createClient(
  process.env.SUPABASE_URL || 'http://localhost:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-srk',
  { auth: { persistSession: false } }
);

export async function cleanTables(tables: string[]) {
  const sb = testSupabase();
  for (const t of tables) {
    try {
      await sb.from(t).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    } catch (e) {
      // Ignore errors if table does not exist or empty
    }
  }
}

export async function withTestOwner<T>(fn: (ownerId: string) => Promise<T>): Promise<T> {
  const sb = testSupabase();
  const { data, error } = await sb.auth.admin.createUser({
    email: `test+${Date.now()}@coreberg.test`,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`Failed to create test user: ${error?.message}`);
  }
  try {
    return await fn(data.user.id);
  } finally {
    await sb.auth.admin.deleteUser(data.user.id);
  }
}
