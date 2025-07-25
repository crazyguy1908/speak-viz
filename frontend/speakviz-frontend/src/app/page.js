'use client'
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Login from './components/landing';
import { supabase } from '../supabaseClient.js';
import SpeakVizLanding from './components/home';

export default function Home() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      
      if (session) {
        router.push('/recorder');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        router.push('/recorder');
      } else {
        router.push('/homepage');
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  if (loading) return <div>Loading...</div>;
  if (session) return <div>Redirecting...</div>;

  return <Login />;
}