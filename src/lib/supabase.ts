import { createClient } from '@supabase/supabase-js';


// Initialize database client
const supabaseUrl = 'https://aixvqeyviciiehxegtby.databasepad.com';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjZhYTE1YWNiLTkwOTItNDdlOS1iZGY3LTVlNWUzNGIzMjAzNSJ9.eyJwcm9qZWN0SWQiOiJhaXh2cWV5dmljaWllaHhlZ3RieSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzcxNzE3OTY1LCJleHAiOjIwODcwNzc5NjUsImlzcyI6ImZhbW91cy5kYXRhYmFzZXBhZCIsImF1ZCI6ImZhbW91cy5jbGllbnRzIn0.DQi8xUGzvj6168-e2B2sDUWu9hYadi62LHhNF3AnGns';
const supabase = createClient(supabaseUrl, supabaseKey);


export { supabase };