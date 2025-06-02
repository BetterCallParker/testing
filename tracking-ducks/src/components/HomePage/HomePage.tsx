import React from 'react';

const HomePage: React.FC = () => {
  return (
    <div className="py-12 bg-gray-50">
      <div className="container mx-auto px-4 text-center">
        <h1 className="text-5xl font-bold text-gray-800 mb-4">
          Track the Journey
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Find ducks. Log locations. Share stories.
        </p>
        <div className="space-x-4">
          <button
            type="button"
            className="px-6 py-3 bg-yellow-400 text-gray-800 font-semibold rounded-lg shadow-md hover:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-opacity-75"
          >
            Found a Duck?
          </button>
          <button
            type="button"
            className="px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75"
          >
            Learn More
          </button>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
