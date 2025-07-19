import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://hdnudubhrjynjdioaqdc.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkbnVkdWJocmp5bmpkaW9hcWRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE3MjIwNjYsImV4cCI6MjA2NzI5ODA2Nn0.O1AxSTfFhi1PPchyMRkrYS045fzQJKE46j0GQhOLA6c')
export { supabase };