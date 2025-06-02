import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';

const SignUpForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
    } else if (data.user && data.user.identities && data.user.identities.length === 0) {
      // This case might indicate that email confirmation is required but the user already exists without confirmation.
      // Supabase signUp might return a user object even if the user exists but is unconfirmed.
      // Or if "Confirm email" is disabled in Supabase settings, a new user is created and session is set.
      setMessage("User already exists and is unconfirmed, or sign up requires email confirmation. Please check your email to confirm or try logging in.");
      // If "Confirm email" is OFF, data.session will be set, data.user will have the user.
      // If "Confirm email" is ON, data.session will be null, data.user will have the user (if new or existing unconfirmed).
      if (data.session) {
        setMessage("Sign up successful! You are now logged in.");
      } else {
         setMessage("Sign up successful! Please check your email to confirm your account.");
      }
    } else if (data.user) {
      setMessage("Sign up successful! Please check your email to confirm your account.");
      if (data.session) { // If "Confirm email" is disabled, session is returned.
         setMessage("Sign up successful! You are now logged in.");
      }
    }
  };

  return (
    <form onSubmit={handleSignUp} className="space-y-4 p-4 border border-gray-300 rounded-lg shadow-md max-w-md mx-auto">
      <h2 className="text-2xl font-semibold text-center">Sign Up</h2>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
        <input
          id="email"
          type="email"
          placeholder="Your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
      </div>
      <div>
        <label htmlFor="password"className="block text-sm font-medium text-gray-700">Password</label>
        <input
          id="password"
          type="password"
          placeholder="Your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
      >
        {loading ? 'Signing Up...' : 'Sign Up'}
      </button>
      {error && <p className="text-red-500 text-sm text-center">{error}</p>}
      {message && <p className="text-green-500 text-sm text-center">{message}</p>}
    </form>
  );
};

export default SignUpForm;
