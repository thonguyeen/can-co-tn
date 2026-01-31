import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  // Check if Supabase is properly configured
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
    // No valid Supabase config - redirect to demo
    redirect('/demo')
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      redirect('/feed')
    } else {
      redirect('/login')
    }
  } catch {
    // If Supabase fails, redirect to demo
    redirect('/demo')
  }
}
