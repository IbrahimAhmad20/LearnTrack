const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // service role key bypasses Row Level Security
);

/**
 * Execute raw SQL via Supabase's rpc or postgres extension.
 * For simple queries we use the Supabase Data API (supabase.from(...)).
 * For complex analytical raw SQL we use the `query` RPC function.
 *
 * To enable raw SQL, run this ONCE in your Supabase SQL editor:
 *
 *   create or replace function query(sql text, params jsonb default '[]')
 *   returns jsonb language plpgsql security definer as $$
 *   declare result jsonb;
 *   begin
 *     execute sql into result using params;
 *     return result;
 *   end; $$;
 *
 * For this project we use supabase.from() for all CRUD operations,
 * and supabase.rpc('query', { sql }) only for the analytical endpoints.
 */

async function connectDB() {
  // Verify connection on startup
  const { error } = await supabase.from('users').select('user_id').limit(1);
  if (error && error.code !== 'PGRST116') {
    // PGRST116 = table empty, that's fine
    console.error('Supabase connection error:', error.message);
    console.error('Make sure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env');
    process.exit(1);
  }
  console.log('Connected to Supabase (PostgreSQL)');
}

/**
 * Run raw SQL using Supabase's postgres function.
 * Used only in analyticsController for complex multi-join queries.
 *
 * @param {string} sql    – parameterized SQL ($1, $2 style)
 * @param {Array}  params – array of bind values
 */
async function rawQuery(sql, params = []) {
  const { data, error } = await supabase.rpc('exec_sql', { sql, params });
  if (error) throw new Error(error.message);
  return data;
}

module.exports = { supabase, connectDB, rawQuery };
