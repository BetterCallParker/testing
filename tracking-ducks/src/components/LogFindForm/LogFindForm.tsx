import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import type { Session } from '@supabase/supabase-js';
import LocationPickerMap from '../Map/LocationPickerMap'; // Import the map picker

interface DuckData {
  id: string;
  name?: string | null;
  // Could also pass last known lat/lng of the duck to LocationPickerMap as initialLatitude/Longitude
}

interface LogFindFormProps {
  duck: DuckData;
  session: Session | null;
  onFindLogged: () => void;
  onCancel: () => void;
}

const MAX_DUCK_NAME_LENGTH = 30;
const MAX_NOTES_LENGTH = 500;

const LogFindForm: React.FC<LogFindFormProps> = ({ duck, session, onFindLogged, onCancel }) => {
  const [duckName, setDuckName] = useState<string>('');
  const [latitude, setLatitude] = useState<string>('');
  const [longitude, setLongitude] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [isFetchingLocation, setIsFetchingLocation] = useState<boolean>(false);

  const canNameDuck = session && (!duck.name || duck.name.trim() === '');

  useEffect(() => {
    if (duck.name && !canNameDuck) {
      setDuckName(duck.name);
    }
  }, [duck.name, canNameDuck]);

  const handleLocationSelectedFromMap = (lat: number, lng: number) => {
    setLatitude(lat.toFixed(6));
    setLongitude(lng.toFixed(6));
    setLocationMessage("Location selected on map.");
    setTimeout(() => setLocationMessage(null), 3000);
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationMessage('Geolocation is not supported by your browser.');
      return;
    }
    setIsFetchingLocation(true);
    setLocationMessage('Fetching location...');
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setLatitude(lat.toFixed(6));
        setLongitude(lng.toFixed(6));
        setLocationMessage('Location fetched successfully!');
        setIsFetchingLocation(false);
        setTimeout(() => setLocationMessage(null), 3000);
      },
      (err) => {
        console.error("Error getting location:", err);
        let message = 'Could not fetch location. ';
        switch(err.code) {
          case err.PERMISSION_DENIED: message += "Permission denied."; break;
          case err.POSITION_UNAVAILABLE: message += "Position unavailable."; break;
          case err.TIMEOUT: message += "Request timed out."; break;
          default: message += "Unknown error."; break;
        }
        setLocationMessage(message);
        setIsFetchingLocation(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const validateForm = (): boolean => {
    setError(null);
    if (canNameDuck && duckName.length > MAX_DUCK_NAME_LENGTH) {
      setError(`Duck name cannot exceed ${MAX_DUCK_NAME_LENGTH} characters.`);
      return false;
    }
    if (!latitude || !longitude) {
      setError('Location (Latitude & Longitude) is required. Please select on map or use "Use Current Location".');
      return false;
    }
    if (isNaN(parseFloat(latitude)) || isNaN(parseFloat(longitude))) {
      setError('Latitude and Longitude must be valid numbers.');
      return false;
    }
    if (notes.length > MAX_NOTES_LENGTH) {
      setError(`Notes cannot exceed ${MAX_NOTES_LENGTH} characters.`);
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSuccessMessage(null);
    if (!validateForm()) return;
    setLoading(true);

    try {
      if (canNameDuck && duckName.trim() !== '') {
        const { error: updateDuckError } = await supabase.from('ducks').update({ name: duckName.trim(), named_by: session?.user?.id }).eq('id', duck.id);
        if (updateDuckError) throw new Error(`Failed to update duck name: ${updateDuckError.message}`);
      }
      const findData = {
        duck_id: duck.id, found_by: session?.user?.id || null, found_by_anonymous: !session ? 'A Guest Duck Enthusiast' : null,
        latitude: parseFloat(latitude), longitude: parseFloat(longitude), note: notes.trim() || null, found_at: new Date().toISOString(),
      };
      const { error: insertFindError } = await supabase.from('duck_finds').insert(findData);
      if (insertFindError) throw new Error(`Failed to log find: ${insertFindError.message}`);
      setSuccessMessage('Find logged successfully! Thank you for participating.');
      setTimeout(() => onFindLogged(), 2000);
    } catch (e: any) {
      setError(e.message || 'An unexpected error occurred.');
      console.error('Error logging find:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 bg-white shadow-xl rounded-lg border border-indigo-200 my-8">
      <h2 className="text-xl sm:text-2xl font-bold text-indigo-700 mb-6 text-center">
        Log Your Find for {duck.name || 'this Duck'}
      </h2>
      <form onSubmit={handleSubmit} className="space-y-6"> {/* Increased space-y for better separation */}
        {canNameDuck && (
          <div>
            <label htmlFor="duckName" className="block text-sm font-medium text-gray-700">Name this Duck (Optional, max {MAX_DUCK_NAME_LENGTH} chars)</label>
            <input type="text" id="duckName" value={duckName} onChange={(e) => setDuckName(e.target.value)} maxLength={MAX_DUCK_NAME_LENGTH}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="e.g., Quacky, Sir Reginald" />
            <p className="text-xs text-gray-500 mt-1">{MAX_DUCK_NAME_LENGTH - duckName.length} characters remaining</p>
          </div>
        )}

        <fieldset className="space-y-3 p-3 border rounded-md">
          <legend className="text-sm font-medium text-gray-700 px-1">Location*</legend>
          <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3 mb-2">
            <button type="button" onClick={handleGetCurrentLocation} disabled={isFetchingLocation}
              className="w-full sm:w-auto mb-2 sm:mb-0 px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-70 disabled:bg-blue-400">
              {isFetchingLocation ? 'Fetching...' : 'Use Current Location'}
            </button>
            {locationMessage && ( <p className={`text-xs mt-1 sm:mt-0 ${locationMessage.includes('successfully') || locationMessage.includes('selected') ? 'text-green-600' : 'text-red-600'}`}>{locationMessage}</p>)}
          </div>
          
          <LocationPickerMap
            onLocationChange={handleLocationSelectedFromMap}
            currentLatitude={latitude}
            currentLongitude={longitude}
            // initialLatitude={duck.last_known_lat || undefined} // TODO: Pass last known duck lat/lng if available
            // initialLongitude={duck.last_known_lng || undefined}
            mapHeight="h-64 sm:h-72"
          />
          {/* Hidden inputs to still hold the lat/lng for form submission, if needed, or rely on state.
              For this setup, state is directly used, so hidden inputs are not strictly necessary.
              However, if we wanted to make them part of the form data for some reason:
          <input type="hidden" name="latitude" value={latitude} />
          <input type="hidden" name="longitude" value={longitude} />
          */}
           <p className="text-xs text-gray-500">Click on the map to set a marker, or drag an existing marker. Current Coords: Lat: {latitude || "N/A"}, Lng: {longitude || "N/A"}</p>
        </fieldset>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700">Share Your Story / Notes (Optional, max {MAX_NOTES_LENGTH} chars)</label>
          <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} maxLength={MAX_NOTES_LENGTH}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            placeholder="e.g., Found this little one by the lake during my morning walk!" />
          <p className="text-xs text-gray-500 mt-1">{MAX_NOTES_LENGTH - notes.length} characters remaining</p>
        </div>

        {error && (<div className="p-3 text-sm text-red-700 bg-red-100 rounded-lg border border-red-300" role="alert">{error}</div>)}
        {successMessage && !error && (<div className="p-3 text-sm text-green-700 bg-green-100 rounded-lg border border-green-300" role="alert">{successMessage}</div>)}

        <div className="flex items-center justify-end space-x-3 pt-2">
          <button type="button" onClick={onCancel} disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" disabled={loading || !!successMessage}
            className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:bg-green-400">
            {loading ? 'Submitting...' : 'Log This Find!'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default LogFindForm;
