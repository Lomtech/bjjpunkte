// netlify/functions/config.js
// Gibt die Supabase-Credentials sicher aus den Netlify Env Vars zurück.
// Die Anon Key ist für den Browser gedacht (kein Secret), die URL ebenfalls.

exports.handler = async () => {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify({
      supabaseUrl: process.env.SUPABASE_URL || '',
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
    }),
  };
};