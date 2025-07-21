'use client'
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Recorder from "./recorder/Recorder.js";
import Login from "./landing.js";
import { supabase } from './supabaseClient';

function App() {
  // State to track authentication status
  const [session, setSession] = useState(null);
  // State to track if we're still checking authentication
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false); // Set loading to false after getting session
    });

    // Listen for auth changes (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false); // Set loading to false on auth change
    });

    // Cleanup subscription on component unmount
    return () => subscription.unsubscribe();
  }, []);

  // Show loading while checking authentication
  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <Router>
      <div className="App">
        <Routes>
          {/* If user is authenticated, redirect to recorder, otherwise show login */}
          <Route
            path="/"
            element={session ? <Navigate to="/recorder" replace /> : <Login />}
          />
          
          {/* Protected route - only accessible if authenticated */}
          <Route
            path="/recorder"
            element={session ? <Recorder user={session.user} /> : <Navigate to="/" replace />}
          />
          
          {/* Login route - redirect to recorder if already authenticated */}
          <Route
            path="/login"
            element={session ? <Navigate to="/recorder" replace /> : <Login />}
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;