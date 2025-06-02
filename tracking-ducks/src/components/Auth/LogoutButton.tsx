import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';

const LogoutButton: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogout = async () => {
    setError(null);
    setLoading(true);
    const { error: signOutError } = await supabase.auth.signOut();
    setLoading(false);
    if (signOutError) {
      setError(signOutError.message);
    }
    // Session update will be handled by onAuthStateChange in App.tsx
  };

  return (
    <div className="text-center mt-8">
      <button
        onClick={handleLogout}
        disabled={loading}
        className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
      >
        {loading ? 'Logging Out...' : 'Logout'}
      </button>
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
    </div>
  );
};

export default LogoutButton;
