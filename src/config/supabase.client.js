import { createClient } from '@supabase/supabase-js'
import { config } from './env.config.js'

export const supabase = createClient(
	config.supabase.url,
	config.supabase.publishableKey,
	{
		auth: {
			autoRefreshToken: false,
			persistSession: false
		}
	}
)

export const supabaseAdmin = createClient(
	config.supabase.url,
	config.supabase.secretKey,
	{
		auth: {
			autoRefreshToken: false,
			persistSession: false
		}
	}
)
