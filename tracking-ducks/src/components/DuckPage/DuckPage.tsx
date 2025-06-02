import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import type { Session } from '@supabase/supabase-js';
import LogFindForm from '../LogFindForm/LogFindForm';
import JourneyMap, { FindLocation as MapFindLocation } from '../Map/JourneyMap'; // Renamed to avoid conflict

// Define a type for the duck data
interface DuckData {
  id: string;
  short_code: string;
  qr_code_url?: string | null;
  name?: string | null;
  named_by?: string | null;
  created_at: string;
  first_found_at?: string | null;
  total_finds: number;
  total_distance: number;
  is_active: boolean;
  batch_id?: string | null;
}

// Extended FindLocation for Story Timeline
interface StoryFindLocation extends MapFindLocation {
  found_by: string | null; // User ID
  found_by_anonymous?: string | null; // Name for anonymous finders
  // Optional profile data - depends on Supabase query and RLS
  profiles?: { 
    username: string | null;
    display_name: string | null;
  } | null;
}

const DuckPage: React.FC = () => {
  const { short_code } = useParams<{ short_code: string }>();
  const [duck, setDuck] = useState<DuckData | null>(null);
  const [finds, setFinds] = useState<StoryFindLocation[]>([]); // Use extended type
  const [loadingDuck, setLoadingDuck] = useState(true);
  const [loadingFinds, setLoadingFinds] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [showLogFindForm, setShowLogFindForm] = useState(false);
  const [findLoggedSuccess, setFindLoggedSuccess] = useState(false);

  const fetchDuckAndFindsData = async (currentShortCode: string | undefined) => {
    if (!currentShortCode) {
      setError('No short code provided in URL.');
      setLoadingDuck(false);
      return;
    }

    setLoadingDuck(true);
    setLoadingFinds(true);
    setError(null);
    setDuck(null);
    setFinds([]);
    setFindLoggedSuccess(false);

    try {
      const { data: duckData, error: duckError } = await supabase
        .from('ducks')
        .select('*')
        .eq('short_code', currentShortCode)
        .single();

      if (duckError) {
        if (duckError.code === 'PGRST116') {
          setError(`Duck with short code "${currentShortCode}" not found.`);
        } else {
          setError(`Error fetching duck data: ${duckError.message}`);
        }
        setLoadingDuck(false);
        setLoadingFinds(false);
        return;
      }
      
      if (duckData) {
        setDuck(duckData as DuckData);
        setLoadingDuck(false);

        const { data: findsData, error: findsError } = await supabase
          .from('duck_finds')
          .select('id, latitude, longitude, found_at, note, found_by, found_by_anonymous, profiles ( username, display_name )')
          .eq('duck_id', duckData.id)
          .order('found_at', { ascending: false }); // Show newest finds first for timeline

        if (findsError) {
          console.error('Error fetching finds:', findsError.message);
          // If RLS on profiles fails, this join might return an error or partial data.
          // Consider a fallback query without the join if this is an issue.
        } else if (findsData) {
          setFinds(findsData as StoryFindLocation[]);
        }
      } else {
        setError(`Duck with short code "${currentShortCode}" not found.`);
        setLoadingDuck(false);
      }
    } catch (e: any) {
      setError(`An unexpected error occurred: ${e.message}`);
      setLoadingDuck(false);
    } finally {
      setLoadingFinds(false);
    }
  };
  
  useEffect(() => {
    fetchDuckAndFindsData(short_code);
  }, [short_code]);

  useEffect(() => {
    setLoadingSession(true);
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingSession(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleOpenLogFindForm = () => {
    setShowLogFindForm(true);
    setFindLoggedSuccess(false);
  };

  const handleFindLogged = () => {
    setShowLogFindForm(false);
    setFindLoggedSuccess(true);
    fetchDuckAndFindsData(short_code);
  };

  const handleCancelLogFind = () => {
    setShowLogFindForm(false);
  };

  if (loadingDuck || loadingSession) {
    return <div className="p-4 text-center text-xl">Loading...</div>;
  }

  if (error) {
    return <div className="p-4 text-center text-red-600 bg-red-100 border border-red-400 rounded-md shadow-md">{error}</div>;
  }

  if (!duck) {
    return <div className="p-4 text-center">No duck data available for "{short_code}".</div>;
  }

  const isFirstFind = duck.total_finds === 0 || !duck.first_found_at;

  const LoggedInUserInteraction = () => (
    <div className="mb-8 p-6 bg-blue-50 border-2 border-blue-300 rounded-lg shadow-lg text-center">
      <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-blue-700 mb-2">
        Hello, {session?.user?.user_metadata?.display_name || session?.user?.email}!
      </h2>
      <p className="text-md md:text-lg text-gray-700 mb-4">
        You're viewing <strong className="text-indigo-600">{duck.name || `duck ${duck.short_code}`}</strong>.
        {isFirstFind && !duck.name && " It's unnamed and this is its first find!"}
      </p>
      {/* Map preview can be removed if full map is prominent below */}
      {/* {!isFirstFind && finds.length > 0 && (
         <div className="my-4">
           <JourneyMap finds={finds} mapHeight="h-48 sm:h-64" />
         </div>
      )} */}
      <button
        onClick={handleOpenLogFindForm}
        className="px-6 py-3 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75 text-sm sm:text-base"
      >
        {isFirstFind && !duck.name ? "Be the First to Name & Log Find!" : "Log Your Find"}
      </button>
    </div>
  );
  
  const VisitorInteractionSection = () => ( // This is now only for non-logged-in users
    <div className="mb-8 p-6 bg-yellow-100 border-2 border-yellow-400 rounded-lg shadow-lg text-center">
      <h2 className="text-3xl sm:text-4xl font-bold text-yellow-700 mb-3">🎉 Congratulations! You found a duck! 🎉</h2>
      {isFirstFind ? (
        <p className="text-lg sm:text-xl text-yellow-600 font-semibold mb-4">
          This is the very first time this duck has been spotted in the wild!
        </p>
      ) : (
        <>
          <p className="text-lg sm:text-xl text-gray-700 mb-2">
            This duck has already traveled <strong className="text-indigo-600">{duck.total_distance || 0} km</strong> and been found <strong className="text-indigo-600">{duck.total_finds || 0} times</strong>.
          </p>
          {finds.length > 0 ? (
            <div className="my-4">
              <JourneyMap finds={finds} mapHeight="h-48 sm:h-64" />
            </div>
          ) : loadingFinds ? (
            <p className="text-sm text-gray-500">Loading map data...</p>
          ) : (
            <div className="my-4 p-3 bg-gray-50 rounded-md border border-gray-300 text-sm">
              No location data yet for the map preview.
            </div>
          )}
        </>
      )}
      <div className="mt-6 p-4 bg-indigo-50 border border-indigo-200 rounded-md">
        <p className="text-md sm:text-lg text-indigo-700 mb-3">
          Want to {isFirstFind ? "name this duck, " : ""}log your find, and track its journey?
        </p>
        <div className="flex flex-col sm:flex-row justify-center items-center space-y-3 sm:space-y-0 sm:space-x-4">
          <Link to="/login" className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-75 w-full sm:w-auto text-sm sm:text-base">Log In</Link>
          <Link to="/signup" className="px-6 py-3 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75 w-full sm:w-auto text-sm sm:text-base">Create Account</Link>
        </div>
        <p className="mt-4 text-sm text-gray-600">Or</p>
        <button onClick={handleOpenLogFindForm} className="mt-2 px-6 py-3 bg-gray-500 text-white font-semibold rounded-lg shadow-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-75 w-full sm:w-auto text-sm sm:text-base">Continue as Guest to Log Find</button>
      </div>
    </div>
  );

  const StoryTimeline = () => (
    <div className="mt-6 space-y-6">
      {finds.map((find) => {
        let finderName = "An unknown finder";
        if (find.profiles) { // Registered user with profile info
          finderName = find.profiles.display_name || find.profiles.username || `User ${find.found_by?.substring(0,8)}`;
        } else if (find.found_by) { // Registered user, but profile info not available/loaded
          finderName = `User ID: ${find.found_by.substring(0, 8)}...`;
        } else if (find.found_by_anonymous) { // Anonymous user with provided name
          finderName = find.found_by_anonymous;
        }
        // If all are null, it remains "An unknown finder"

        return (
          <div key={find.id} className="p-4 bg-gray-50 rounded-lg shadow-sm border border-gray-200">
            <p className="text-sm text-gray-500 mb-1">
              Found on: {new Date(find.found_at).toLocaleDateString()} at {new Date(find.found_at).toLocaleTimeString()} by <strong className="text-indigo-600">{finderName}</strong>
            </p>
            {find.note ? (
              <p className="text-gray-700 whitespace-pre-wrap">{find.note}</p>
            ) : (
              <p className="text-gray-500 italic">No story shared for this find.</p>
            )}
          </div>
        );
      })}
      {finds.length === 0 && !loadingFinds && (
        <p className="text-gray-500 italic">No stories recorded for this duck yet.</p>
      )}
    </div>
  );

  return (
    <div className="container mx-auto p-2 sm:p-4">
      {findLoggedSuccess && (
        <div className="mb-6 p-4 text-center text-green-700 bg-green-100 border border-green-300 rounded-md shadow-md">
          Successfully logged your find! The duck's information has been updated.
        </div>
      )}

      {!showLogFindForm && ( // Only show interaction sections if form is not active
         session ? <LoggedInUserInteraction /> : <VisitorInteractionSection />
      )}

      {showLogFindForm && duck && (
        <LogFindForm 
          duck={duck} 
          session={session} 
          onFindLogged={handleFindLogged}
          onCancel={handleCancelLogFind} 
        />
      )}

      {!showLogFindForm && (
        <div className="bg-white shadow-xl rounded-lg p-4 sm:p-6 mt-4">
          <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-center text-indigo-700">
            Duck Dossier: <span className="text-yellow-500">{duck.short_code}</span>
          </h1>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <div className="bg-gray-50 p-3 sm:p-4 rounded-md shadow-sm border border-gray-200">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2 border-b pb-1">Identity</h2>
              <p className="text-sm sm:text-base"><strong className="text-gray-600 w-24 sm:w-28 inline-block">Name:</strong> {duck.name || <span className="italic text-gray-500">Unnamed Duck</span>}</p>
              <p className="text-sm sm:text-base"><strong className="text-gray-600 w-24 sm:w-28 inline-block">Short Code:</strong> {duck.short_code}</p>
              <p className="text-sm sm:text-base"><strong className="text-gray-600 w-24 sm:w-28 inline-block">Duck ID:</strong> <span className="text-xs sm:text-sm text-gray-500">{duck.id}</span></p>
              {duck.qr_code_url && (
                <p className="text-sm sm:text-base"><strong className="text-gray-600 w-24 sm:w-28 inline-block">QR Link:</strong> <a href={duck.qr_code_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all">{duck.qr_code_url}</a></p>
              )}
            </div>
            <div className="bg-gray-50 p-3 sm:p-4 rounded-md shadow-sm border border-gray-200">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2 border-b pb-1">Stats</h2>
              <p className="text-sm sm:text-base"><strong className="text-gray-600 w-32 sm:w-36 inline-block">Total Finds:</strong> {duck.total_finds}</p>
              <p className="text-sm sm:text-base"><strong className="text-gray-600 w-32 sm:w-36 inline-block">Total Distance:</strong> {duck.total_distance || 0} km</p>
              <p className="text-sm sm:text-base"><strong className="text-gray-600 w-32 sm:w-36 inline-block">Status:</strong> {duck.is_active ? <span className="text-green-600 font-semibold">Active</span> : <span className="text-red-600 font-semibold">Inactive</span>}</p>
            </div>
            <div className="bg-gray-50 p-3 sm:p-4 rounded-md shadow-sm border border-gray-200 md:col-span-2">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2 border-b pb-1">History & Provenance</h2>
              <p className="text-sm sm:text-base"><strong className="text-gray-600 w-32 inline-block">Created At:</strong> {new Date(duck.created_at).toLocaleString()}</p>
              {duck.first_found_at ? (
                <p className="text-sm sm:text-base"><strong className="text-gray-600 w-32 inline-block">First Found At:</strong> {new Date(duck.first_found_at).toLocaleString()}</p>
              ) : (
                <p className="text-sm sm:text-base"><strong className="text-gray-600 w-32 inline-block">First Found At:</strong> <span className="italic text-gray-500">Not yet found.</span></p>
              )}
              {duck.batch_id && <p className="text-sm sm:text-base"><strong className="text-gray-600 w-32 inline-block">Batch ID:</strong> <span className="text-xs sm:text-sm text-gray-500">{duck.batch_id}</span></p>}
            </div>
          </div>
          
          <div className="mt-8 border-t-2 border-indigo-100 pt-6">
            <h2 className="text-xl sm:text-2xl font-semibold text-indigo-600 mb-4">Full Journey Map & Story Timeline</h2>
            {loadingFinds && !finds.length ? ( // Show loading only if finds are empty
              <p className="text-gray-500">Loading map and find history...</p>
            ) : finds.length > 0 ? (
              <>
                <JourneyMap finds={finds} mapHeight="h-[300px] sm:h-[400px] md:h-[500px]" />
                <StoryTimeline />
              </>
            ) : (
              <p className="text-gray-600 italic">No find locations or stories recorded for this duck yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DuckPage;
