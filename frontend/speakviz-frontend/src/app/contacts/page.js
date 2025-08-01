"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/supabaseClient";
import Navbar from "../components/navbar";

export default function ContactsPage() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);

      if (!session) {
        router.push("/");
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        router.push("/");
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  if (loading) return <div>Loading...</div>;
  if (!session) return <div>Redirecting to login...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <Navbar />
      <div className="container mx-auto px-4 py-12 pt-20 flex flex-col items-center justify-center min-h-screen">
        <div className="text-center max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Contact Us
          </h1>
          <p className="text-xl text-gray-700 mb-4">
            Have questions or need support?
          </p>
          <p className="text-lg text-gray-600">
            Please email us at{" "}
            <a 
              href="mailto:contact@speakviz.net" 
              className="text-blue-600 hover:text-blue-800 font-semibold underline"
            >
              contact@speakviz.net
            </a>
          </p>
        </div>
      </div>
    </div>
  );
} 