import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, Outlet, Navigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import type { Session } from '@supabase/supabase-js';

// Page & Auth Components
import HomePage from './components/HomePage/HomePage';
import SignUpForm from './components/Auth/SignUpForm';
import LoginForm from './components/Auth/LoginForm';
import LogoutButton from './components/Auth/LogoutButton';

// Page Components
import DuckPage from './components/DuckPage/DuckPage'; // Replaced placeholder

// Placeholder Components
// import DuckPagePlaceholder from './components/Placeholders/DuckPagePlaceholder'; // Replaced by actual DuckPage
import ProfilePagePlaceholder from './components/Placeholders/ProfilePagePlaceholder';
import LeaderboardPagePlaceholder from './components/Placeholders/LeaderboardPagePlaceholder';
import MapPagePlaceholder from './components/Placeholders/MapPagePlaceholder';
import AdminPagePlaceholder from './components/Placeholders/AdminPagePlaceholder'; // For /admin route

// Admin Components
import QrGeneratorPage from './components/Admin/QrGeneratorPage'; // For /admin/qr-generator route

import './App.css'; // Main app styles

// Main Layout Component
const Layout: React.FC<{ session: Session | null }> = ({ session }) => {
  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      <header className="py-4 bg-indigo-600 text-white shadow-lg">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <Link to="/" className="text-2xl font-bold hover:text-indigo-200">Tracking Ducks</Link>
          <nav className="space-x-4">
            <Link to="/" className="hover:text-indigo-200">Home</Link>
            <Link to="/map" className="hover:text-indigo-200">Map</Link>
            <Link to="/leaderboard" className="hover:text-indigo-200">Leaderboard</Link>
            {session ? (
              <>
                <Link to={`/profile/${session.user.id}`} className="hover:text-indigo-200">Profile</Link>
                {/* Admin Links - visible if logged in for now, ideally role-based */}
                <span className="text-gray-400">|</span>
                <Link to="/admin" className="hover:text-indigo-200 text-sm">Admin</Link>
                <Link to="/admin/qr-generator" className="hover:text-indigo-200 text-sm">QR Gen</Link>
                <span className="text-gray-400">|</span>
                <LogoutButton />
              </>
            ) : (
              <>
                <Link to="/login" className="hover:text-indigo-200">Login</Link>
                <Link to="/signup" className="hover:text-indigo-200">Sign Up</Link>
              </>
            )}
          </nav>
        </div>
        {session && (
          <div className="container mx-auto px-4 mt-2 text-sm">
            Logged in as: {session.user.email}
          </div>
        )}
      </header>

      <main className="flex-grow container mx-auto p-4">
        <Outlet /> {/* Content for the matched route will be rendered here */}
      </main>

      <footer className="py-6 bg-gray-800 text-white text-center">
        <p>&copy; {new Date().getFullYear()} Tracking Ducks. All rights reserved.</p>
      </footer>
    </div>
  );
};

// ProtectedRoute Component (Optional - for routes requiring authentication)
// For now, just an example, can be expanded later.
const ProtectedRoute: React.FC<{ session: Session | null, children: JSX.Element }> = ({ session, children }) => {
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  return children;
};


function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    }).catch(error => {
      console.error("Error getting session:", error);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-xl text-gray-700">Loading session...</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout session={session} />}> {/* Layout wraps all pages */}
          <Route index element={<HomePage />} />
          <Route path="signup" element={!session ? <SignUpForm /> : <Navigate to="/" />} />
          <Route path="login" element={!session ? <LoginForm /> : <Navigate to="/" />} />
          
          {/* Duck Page Route */}
          <Route path="duck/:short_code" element={<DuckPage />} />
          
          {/* Example of a protected route, modify as needed */}
          <Route 
            path="profile/:userId" 
            element={
              <ProtectedRoute session={session}>
                <ProfilePagePlaceholder />
              </ProtectedRoute>
            } 
          />
          <Route path="leaderboard" element={<LeaderboardPagePlaceholder />} />
          <Route path="map" element={<MapPagePlaceholder />} />
          <Route 
            path="admin" 
            element={
              <ProtectedRoute session={session}>
                <AdminPagePlaceholder />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="admin/qr-generator"
            element={
              <ProtectedRoute session={session}>
                <QrGeneratorPage />
              </ProtectedRoute>
            }
          />
          
          {/* Catch-all for 404 Not Found (Optional) */}
          <Route path="*" element={
            <div className="text-center p-8">
              <h1 className="text-4xl font-bold">404 - Not Found</h1>
              <p className="mt-4">Sorry, the page you are looking for does not exist.</p>
              <Link to="/" className="mt-6 inline-block py-2 px-4 bg-indigo-600 text-white rounded hover:bg-indigo-700">
                Go to Homepage
              </Link>
            </div>
          } />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
