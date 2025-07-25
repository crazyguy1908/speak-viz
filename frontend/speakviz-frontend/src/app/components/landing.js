'use client'
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../supabaseClient';
import { Button } from '@/components/ui/button';
import './landing-form.css';

const SigninForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      let result;
      if (isSignUp) {
        result = await supabase.auth.signUp({ email, password });
      } else {
        result = await supabase.auth.signInWithPassword({ email, password });
      }
      if (result.error) throw result.error;
      if (result.data.session) {
        router.push('/recorder');
      } else if (isSignUp) {
        alert('Please check your email to confirm your account');
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="svz-signin-root">
      <div className="svz-signin-card">
        <div>
          <h2 className="svz-signin-title">
            {isSignUp ? 'Create your account' : 'Sign in to your account'}
          </h2>
        </div>
        <form className="svz-signin-form" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="svz-signin-label">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="svz-signin-input"
              placeholder="Email address"
            />
          </div>
          <div>
            <label htmlFor="password" className="svz-signin-label">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="svz-signin-input"
              placeholder="Password"
            />
          </div>
          {error && (
            <div className="svz-signin-error">{error}</div>
          )}
          <div>
            <Button
              type="submit"
              disabled={loading}
              className="svz-signin-btn"
            >
              {loading ? 'Loading...' : (isSignUp ? 'Sign Up' : 'Sign In')}
            </Button>
          </div>
          <div className="svz-signin-toggle-wrap">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="svz-signin-toggle"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SigninForm;