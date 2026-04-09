const SUPABASE_URL = 'https://tpwozyxpgklwvdmhgmvn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_S3JnMDDZ5c-aavBn7f_Wdw_wx-6ZZCT';

let client = null;

export function getSupabase() {
  if (!client) {
    if (!window.supabase?.createClient) {
      throw new Error('Supabase JS not loaded');
    }
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return client;
}

export { SUPABASE_URL, SUPABASE_ANON_KEY };
