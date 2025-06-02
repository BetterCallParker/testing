import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';

const LoginForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);
    if (signInError) {
      setError(signInError.message);
    } else if (data.user) {
      setMessage('Login successful! Redirecting...');
      // Handle successful login, e.g., redirect or update app state
      // In App.tsx, the onAuthStateChange listener will handle session updates.
    } else {
      setError('An unknown error occurred during login.');
    }
  };

  return (
    <form onSubmit={handleLogin} className="space-y-4 p-4 border border-gray-300 rounded-lg shadow-md max-w-md mx-auto mt-8">
      <h2 className="text-2xl font-semibold text-center">Login</h2>
      <div>
        <label htmlFor="email-login" className="block text-sm font-medium text-gray-700">Email</label>
        <input
          id="email-login"
          type="email"
          placeholder="Your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
      </div>
      <div>
        <label htmlFor="password-login" className="block text-sm font-medium text-gray-700">Password</label>
        <input
          id="password-login"
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
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
      >
        {loading ? 'Logging In...' : 'Login'}
      </button>
      {error && <p className="text-red-500 text-sm text-center">{error}</p>}
      {message && <p className="text-blue-500 text-sm text-center">{message}</p>}
    </form>
  );
};

export default LoginForm;
