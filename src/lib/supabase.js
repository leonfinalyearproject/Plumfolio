import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xcjbpexnunryepzcimoh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjamJwZXhudW5yeWVwemNpbW9oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4MTE3NDYsImV4cCI6MjA4NTM4Nzc0Nn0.N1nNgILE_sRFJbsi7cM8_cFh62kWtqis9Krwq3JlZZA';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
