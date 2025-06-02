import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L, { LatLngExpression, LatLngBounds } from 'leaflet';

// Minimal interface for a find, ensure it has lat/long
export interface FindLocation {
  id: string;
  latitude: number | null;
  longitude: number | null;
  found_at: string;
  note?: string | null;
}

interface JourneyMapProps {
  finds: FindLocation[];
  mapHeight?: string; // e.g., "h-64", "h-96"
}

// Fix for default icon issue with Webpack/React-Leaflet
// (see https://github.com/PaulLeCam/react-leaflet/issues/453)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

const JourneyMap: React.FC<JourneyMapProps> = ({ finds, mapHeight = "h-96" }) => {
  const mapRef = useRef<L.Map>(null);

  const validFinds = finds.filter(
    (find) => find.latitude !== null && find.longitude !== null && !isNaN(find.latitude) && !isNaN(find.longitude)
  ) as { id: string; latitude: number; longitude: number; found_at: string, note?: string | null }[];

  useEffect(() => {
    if (mapRef.current && validFinds.length > 0) {
      const bounds = new LatLngBounds(validFinds.map(find => [find.latitude, find.longitude] as LatLngExpression));
      if (bounds.isValid()) {
        mapRef.current.fitBounds(bounds, { padding: [50, 50] }); // Add padding
      }
    }
  }, [finds, validFinds]); // Rerun when finds change to adjust bounds

  if (validFinds.length === 0) {
    return (
      <div className={`p-4 text-center text-gray-500 bg-gray-100 rounded-md ${mapHeight}`}>
        No location data available to display on the map.
      </div>
    );
  }

  // Default center if only one find or if bounds are not valid for some reason
  const defaultCenter: LatLngExpression = 
    validFinds.length > 0 ? [validFinds[0].latitude, validFinds[0].longitude] : [51.505, -0.09]; // Fallback to London

  const pathCoordinates: LatLngExpression[] = validFinds.map(find => [find.latitude, find.longitude]);

  return (
    <MapContainer center={defaultCenter} zoom={validFinds.length > 1 ? 13 : 10} scrollWheelZoom={true} className={`${mapHeight} w-full rounded-lg shadow-md`} ref={mapRef}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {validFinds.map((find, index) => (
        <Marker key={find.id || index} position={[find.latitude, find.longitude]}>
          <Popup>
            Find #{index + 1} on: {new Date(find.found_at).toLocaleDateString()}
            <br />
            Location: ({find.latitude.toFixed(4)}, {find.longitude.toFixed(4)})
            {find.note && <><br />Note: {find.note}</>}
          </Popup>
        </Marker>
      ))}
      {pathCoordinates.length > 1 && (
        <Polyline positions={pathCoordinates} color="blue" weight={3} opacity={0.7} />
      )}
    </MapContainer>
  );
};

export default JourneyMap;
