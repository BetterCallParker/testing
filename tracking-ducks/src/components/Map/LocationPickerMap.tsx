import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L, { LatLngExpression, LatLng } from 'leaflet';

// Ensure Leaflet's CSS is loaded globally (e.g., in main.tsx or App.tsx)
// import 'leaflet/dist/leaflet.css';

// Fix for default icon issue (if not already handled globally)
// delete (L.Icon.Default.prototype as any)._getIconUrl;
// L.Icon.Default.mergeOptions({
//   iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
//   iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
//   shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
// });

interface LocationPickerMapProps {
  onLocationChange: (lat: number, lng: number) => void;
  initialLatitude?: number | null;
  initialLongitude?: number | null;
  mapHeight?: string;
  currentLatitude?: string | null; // Current latitude from form (string)
  currentLongitude?: string | null; // Current longitude from form (string)
}

const DEFAULT_CENTER: LatLngExpression = [51.505, -0.09]; // London
const DEFAULT_ZOOM = 7; // Further out zoom for initial view

interface DraggableMarkerProps {
  position: LatLngExpression;
  onDragEnd: (event: L.LeafletMouseEvent | L.DragEndEvent) => void;
}

const DraggableMarker: React.FC<DraggableMarkerProps> = ({ position, onDragEnd }) => {
  const markerRef = useRef<L.Marker>(null);
  const map = useMap();

  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          onDragEnd(marker.getLatLng() as any); // Pass LatLng object
        }
      },
    }),
    [onDragEnd],
  );
  
  // Fly to new position when props.position changes
  useEffect(() => {
    if (position && map) {
        // Check if position is valid numbers
        const lat = typeof position[0] === 'number' ? position[0] : parseFloat(position[0] as string);
        const lng = typeof position[1] === 'number' ? position[1] : parseFloat(position[1] as string);
        if (!isNaN(lat) && !isNaN(lng)) {
            map.flyTo([lat, lng], map.getZoom());
        }
    }
  }, [position, map]);


  return (
    <Marker
      draggable={true}
      eventHandlers={eventHandlers}
      position={position}
      ref={markerRef}
    />
  );
};


const MapEvents = ({ onMapClick, onLocationFound }: { 
    onMapClick: (event: L.LeafletMouseEvent) => void;
    onLocationFound?: (event: L.LocationEvent) => void; // Optional
}) => {
  useMapEvents({
    click(e) {
      onMapClick(e);
    },
    locationfound(e) { // Handle map.locate result
        if (onLocationFound) onLocationFound(e);
    }
  });
  return null;
};


const LocationPickerMap: React.FC<LocationPickerMapProps> = ({
  onLocationChange,
  initialLatitude,
  initialLongitude,
  mapHeight = "h-72", // Default height
  currentLatitude,
  currentLongitude,
}) => {
  const [markerPosition, setMarkerPosition] = useState<LatLng | null>(null);
  const mapRef = useRef<L.Map>(null);

  // Initialize markerPosition from props
  useEffect(() => {
    const lat = parseFloat(currentLatitude || initialLatitude?.toString() || '');
    const lng = parseFloat(currentLongitude || initialLongitude?.toString() || '');
    if (!isNaN(lat) && !isNaN(lng)) {
      setMarkerPosition(new LatLng(lat, lng));
    }
  }, [initialLatitude, initialLongitude, currentLatitude, currentLongitude]);

  const handleMapClick = (event: L.LeafletMouseEvent) => {
    const { lat, lng } = event.latlng;
    setMarkerPosition(event.latlng);
    onLocationChange(lat, lng);
  };

  const handleMarkerDrag = (newLatLng: LatLng) => {
    setMarkerPosition(newLatLng);
    onLocationChange(newLatLng.lat, newLatLng.lng);
  };
  
  const centerPosition = markerPosition || (initialLatitude && initialLongitude ? [initialLatitude, initialLongitude] as LatLngExpression : DEFAULT_CENTER);

  return (
    <MapContainer
      center={centerPosition}
      zoom={markerPosition ? 13 : DEFAULT_ZOOM} // Zoom in if marker is set
      scrollWheelZoom={true}
      className={`${mapHeight} w-full rounded-lg shadow-md z-0`} // Ensure z-index is not interfering if it's within complex layouts
      ref={mapRef}
      whenReady={() => { // When map is ready, if markerPosition exists, fly to it
        if (markerPosition && mapRef.current) {
            mapRef.current.flyTo(markerPosition, 13);
        }
      }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapEvents onMapClick={handleMapClick} />
      {markerPosition && (
        <DraggableMarker position={markerPosition} onDragEnd={handleMarkerDrag as any} />
      )}
    </MapContainer>
  );
};

export default LocationPickerMap;
