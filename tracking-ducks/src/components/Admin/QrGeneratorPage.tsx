import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../../supabaseClient';

// Configuration for the base URL - IMPORTANT for QR code generation
// For local dev, this is typically http://localhost:PORT. For production, it's your app's URL.
// const APP_BASE_URL = process.env.NODE_ENV === 'production' ? 'https://your-production-app.com' : 'http://localhost:5173';
// Using a relative path for the QR code value might be more robust if the app is served from the same domain.
// However, QR codes often need absolute URLs if they are scanned by external devices not on the same network during dev.
// For simplicity, using localhost for now. User must update for production.
const APP_BASE_URL = 'http://localhost:5173';


const QrGeneratorPage: React.FC = () => {
  const [shortCode, setShortCode] = useState<string>('');
  const [generatedQrValue, setGeneratedQrValue] = useState<string | null>(null);
  const [duckId, setDuckId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setGeneratedQrValue(null);
    setDuckId(null);

    if (!shortCode.trim()) {
      setError('Short code cannot be empty.');
      return;
    }
    // Basic validation for short_code format (optional)
    if (!/^[a-zA-Z0-9_-]+$/.test(shortCode)) {
        setError('Short code can only contain letters, numbers, underscores, and hyphens.');
        return;
    }


    setLoading(true);

    const qrCodeUrlValue = `${APP_BASE_URL}/duck/${shortCode}`;

    try {
      // Insert into Supabase
      const { data: newDuck, error: insertError } = await supabase
        .from('ducks')
        .insert([
          {
            short_code: shortCode,
            qr_code_url: qrCodeUrlValue, // Storing the URL that the QR code will point to
            // name: `Duck ${shortCode}`, // Optional: default name
            // is_active: true, // Handled by default in DB or can be explicit
            // total_finds: 0, // Handled by default in DB
            // total_distance: 0, // Handled by default in DB
            // first_found_at: null, // Handled by default in DB
            // named_by: null, // Handled by default in DB
          },
        ])
        .select() // To get the inserted row back, including the generated ID
        .single(); // Assuming we insert one and want it back

      if (insertError) {
        if (insertError.code === '23505') { // Unique constraint violation
          setError(`Error: Short code "${shortCode}" already exists. Please choose a unique short code.`);
        } else {
          setError(`Database error: ${insertError.message}`);
        }
        console.error('Supabase insert error:', insertError);
      } else if (newDuck) {
        setSuccessMessage(`Successfully created duck "${shortCode}"!`);
        setGeneratedQrValue(qrCodeUrlValue);
        setDuckId(newDuck.id); // Store the new duck's ID
        // setShortCode(''); // Optionally clear the input field
      } else {
        setError('Failed to create duck and receive confirmation from the database.');
      }
    } catch (e: any) {
      setError(`An unexpected error occurred: ${e.message}`);
      console.error('Unexpected submission error:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 bg-white shadow-lg rounded-lg mt-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6 text-center text-indigo-700">QR Code Generator & Duck Creator</h1>
      
      <form onSubmit={handleSubmit} className="space-y-4 mb-8">
        <div>
          <label htmlFor="shortCode" className="block text-sm font-medium text-gray-700 mb-1">
            Enter Unique Short Code:
          </label>
          <input
            type="text"
            id="shortCode"
            value={shortCode}
            onChange={(e) => setShortCode(e.target.value.toUpperCase())} // Convert to uppercase for consistency
            placeholder="e.g., DUCK007, QUACKYBLUE"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            required
          />
          <p className="text-xs text-gray-500 mt-1">This will be part of the URL and must be unique.</p>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:bg-indigo-400"
        >
          {loading ? 'Generating & Creating...' : 'Generate QR & Create Duck Entry'}
        </button>
      </form>

      {error && (
        <div className="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg border border-red-300" role="alert">
          <span className="font-medium">Error:</span> {error}
        </div>
      )}

      {successMessage && (
        <div className="p-4 mb-4 text-sm text-green-700 bg-green-100 rounded-lg border border-green-300" role="alert">
          <span className="font-medium">Success:</span> {successMessage}
          {duckId && <p className="text-xs">Duck ID: {duckId}</p>}
        </div>
      )}

      {generatedQrValue && (
        <div className="mt-8 p-6 border-2 border-dashed border-indigo-300 rounded-lg bg-indigo-50 text-center">
          <h2 className="text-xl font-semibold text-indigo-600 mb-4">QR Code for: {generatedQrValue}</h2>
          <div className="flex justify-center">
            <QRCodeSVG
              value={generatedQrValue}
              size={256} // Adjust size as needed
              bgColor={"#ffffff"}
              fgColor={"#000000"}
              level={"L"} // Error correction level: L, M, Q, H
              includeMargin={true}
            />
          </div>
          <p className="mt-4 text-sm text-gray-600">
            Scan this QR code to go to the duck's page.
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Ensure your application is running and accessible at <code className="bg-gray-200 p-1 rounded">{APP_BASE_URL}</code> for this to work.
          </p>
        </div>
      )}
       <div className="mt-6 p-3 bg-yellow-50 border border-yellow-300 rounded-md text-xs text-yellow-700">
        <strong>Note for Developers:</strong> The QR code value is generated using the base URL: <code>{APP_BASE_URL}</code>. 
        This must be updated to your production URL when deploying the application.
      </div>
    </div>
  );
};

export default QrGeneratorPage;
