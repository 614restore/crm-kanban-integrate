import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Fetch weather history records.
 * @param {string} location - The location for which to fetch weather history
 * @returns {Promise<Array>} - A promise that resolves to an array of weather records
 */
export const fetchWeatherHistory = async (location) => {
    const { data, error } = await supabase
        .from('weather_history')
        .select('*')
        .eq('location', location);
    if (error) throw new Error(error.message);
    return data;
};

/**
 * Create a new weather history record.
 * @param {string} location - The location for the weather record
 * @param {object} weatherData - An object containing the weather data
 * @returns {Promise<Object>} - A promise that resolves to the created record
 */
export const createWeatherHistoryRecord = async (location, weatherData) => {
    const { data, error } = await supabase
        .from('weather_history')
        .insert([{ location, ...weatherData }]);
    if (error) throw new Error(error.message);
    return data[0];
};
