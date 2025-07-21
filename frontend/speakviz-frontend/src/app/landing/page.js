'use client'
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../supabaseClient';
import Login from '../components/landing';

export default function LoginPage() {
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
  }, [router]);

  if (loading) return <div>Loading...</div>;
  if (session) return <div>Redirecting...</div>;

  return <Login />;
}