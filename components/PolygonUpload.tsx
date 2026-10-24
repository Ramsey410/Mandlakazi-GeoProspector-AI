import React, { useState, useRef } from 'react';
import { Upload, Plus, Trash2, Map, Download } from 'lucide-react';

interface Coordinate {
  lat: number;
  lng: number;
}

interface PolygonUploadProps {
  onPolygonLoaded: (coordinates: Coordinate[]) => void;
  onPolygonClosed?: () => void;
}

const PolygonUpload: React.FC<PolygonUploadProps> = ({ onPolygonLoaded, onPolygonClosed }) => {
  const [coordinates, setCoordinates] = useState<Coordinate[]>([]);
  const [inputLat, setInputLat] = useState('');
  const [inputLng, setInputLng] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<'csv' | 'manual'>('csv');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validation
  const isValidCoordinate = (lat: number, lng: number): boolean => {
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  };

  // CSV Upload Handler
  const handleCSVUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');
    setSuccess('');

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const lines = content.split('\n');
        const newCoordinates: Coordinate[] = [];

        // Detect header and parse coordinates
        let startIndex = 0;
        if (lines[0] && /[a-z]/i.test(lines[0])) {
          startIndex = 1; // Skip header row
        }

        for (let i = startIndex; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const parts = line.split(',').map((p) => p.trim());
          if (parts.length < 2) continue;

          const lat = parseFloat(parts[0]);
          const lng = parseFloat(parts[1]);

          if (isNaN(lat) || isNaN(lng)) {
            setError(`Invalid coordinate at line ${i + 1}: ${line}`);
            return;
          }

          if (!isValidCoordinate(lat, lng)) {
            setError(`Coordinate out of range at line ${i + 1}: (${lat}, ${lng})`);
            return;
          }

          newCoordinates.push({ lat, lng });
        }

        if (newCoordinates.length < 3) {
          setError('Polygon must have at least 3 points');
          return;
        }

        // Auto-close polygon
        if (newCoordinates[0].lat !== newCoordinates[newCoordinates.length - 1].lat ||
            newCoordinates[0].lng !== newCoordinates[newCoordinates.length - 1].lng) {
          newCoordinates.push(newCoordinates[0]);
        }

        setCoordinates(newCoordinates);
        setSuccess(`Loaded ${newCoordinates.length - 1} polygon vertices`);
        onPolygonLoaded(newCoordinates);
      } catch (err) {
        setError(`CSV parsing error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    };

    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Manual Point Addition
  const handleAddPoint = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const lat = parseFloat(inputLat);
    const lng = parseFloat(inputLng);

    if (isNaN(lat) || isNaN(lng)) {
      setError('Invalid latitude or longitude');
      return;
    }

    if (!isValidCoordinate(lat, lng)) {
      setError(`Coordinates out of valid range. Latitude: -90 to 90, Longitude: -180 to 180`);
      return;
    }

    // Check for duplicates
    if (coordinates.some((c) => c.lat === lat && c.lng === lng)) {
      setError('This coordinate already exists');
      return;
    }

    const newCoordinates = [...coordinates, { lat, lng }];
    setCoordinates(newCoordinates);
    setInputLat('');
    setInputLng('');
    setSuccess(`Point added (${newCoordinates.length} total)`);
  };

  // Remove Point
  const handleRemovePoint = (index: number) => {
    const newCoordinates = coordinates.filter((_, i) => i !== index);
    setCoordinates(newCoordinates);
    setError('');
  };

  // Close Polygon
  const handleClosePolygon = () => {
    if (coordinates.length < 3) {
      setError('Polygon must have at least 3 points');
      return;
    }

    // Auto-close if not already closed
    let closedCoordinates = [...coordinates];
    if (closedCoordinates[0].lat !== closedCoordinates[closedCoordinates.length - 1].lat ||
        closedCoordinates[0].lng !== closedCoordinates[closedCoordinates.length - 1].lng) {
      closedCoordinates.push(closedCoordinates[0]);
    }

    setCoordinates(closedCoordinates);
    setSuccess('Polygon closed');
    onPolygonLoaded(closedCoordinates);
    onPolygonClosed?.();
  };

  // Clear All
  const handleClear = () => {
    setCoordinates([]);
    setInputLat('');
    setInputLng('');
    setError('');
    setSuccess('');
  };

  // Download CSV Template
  const handleDownloadTemplate = () => {
    const template = `latitude,longitude
-25.2045,27.0845
-25.2145,27.0945
-25.2245,27.0845
-25.2045,27.0745
-25.2045,27.0845`;

    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(template));
    element.setAttribute('download', 'polygon_template.csv');
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Calculate centroid
  const getCentroid = (): Coordinate | null => {
    if (coordinates.length === 0) return null;
    const validCoords = coordinates.filter((c) => {
      const isClosing = coordinates.length > 1 && coordinates[0] === c && coordinates[coordinates.length - 1] === c;
      return !isClosing;
    });
    if (validCoords.length === 0) return null;

    const avgLat = validCoords.reduce((sum, c) => sum + c.lat, 0) / validCoords.length;
    const avgLng = validCoords.reduce((sum, c) => sum + c.lng, 0) / validCoords.length;
    return { lat: avgLat, lng: avgLng };
  };

  // Calculate area in km²
  const getAreaKm2 = (): number => {
    if (coordinates.length < 3) return 0;
    const KM_PER_DEGREE = 111.0;
    let area = 0;

    for (let i = 0; i < coordinates.length - 1; i++) {
      const lat1 = coordinates[i].lat;
      const lng1 = coordinates[i].lng;
      const lat2 = coordinates[i + 1].lat;
      const lng2 = coordinates[i + 1].lng;
      area += lng1 * lat2 - lng2 * lat1;
    }

    area = Math.abs(area) / 2;
    area = area * (KM_PER_DEGREE * KM_PER_DEGREE);
    return area;
  };

  const centroid = getCentroid();
  const areaKm2 = getAreaKm2();

  return (
    <div className="w-full max-w-4xl mx-auto p-4 bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg shadow-lg border border-slate-200">
      <h2 className="text-2xl font-bold text-slate-800 mb-4 flex items-center gap-2">
        <Map className="w-6 h-6 text-blue-600" />
        Polygon Definition
      </h2>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b border-slate-300">
        <button
          onClick={() => setActiveTab('csv')}
          className={`px-4 py-2 font-semibold transition-colors ${
            activeTab === 'csv'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          <Upload className="inline-block w-4 h-4 mr-2" />
          CSV Upload
        </button>
        <button
          onClick={() => setActiveTab('manual')}
          className={`px-4 py-2 font-semibold transition-colors ${
            activeTab === 'manual'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          <Plus className="inline-block w-4 h-4 mr-2" />
          Manual Entry
        </button>
      </div>

      {/* CSV Upload Tab */}
      {activeTab === 'csv' && (
        <div className="space-y-4 mb-4">
          <div className="border-2 border-dashed border-slate-400 rounded-lg p-6 bg-slate-50 hover:bg-slate-100 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleCSVUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <Upload className="w-5 h-5" />
              Select CSV File
            </button>
          </div>

          <p className="text-sm text-slate-600">
            Expected CSV format: <code className="bg-slate-200 px-2 py-1 rounded">latitude,longitude</code>
          </p>

          <button
            onClick={handleDownloadTemplate}
            className="w-full py-2 px-4 bg-slate-300 hover:bg-slate-400 text-slate-800 font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download Template
          </button>
        </div>
      )}

      {/* Manual Entry Tab */}
      {activeTab === 'manual' && (
        <form onSubmit={handleAddPoint} className="space-y-4 mb-4">
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              step="0.0001"
              placeholder="Latitude (-90 to 90)"
              value={inputLat}
              onChange={(e) => setInputLat(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="number"
              step="0.0001"
              placeholder="Longitude (-180 to 180)"
              value={inputLng}
              onChange={(e) => setInputLng(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Point
          </button>
        </form>
      )}

      {/* Messages */}
      {error && <div className="p-3 bg-red-100 text-red-800 rounded-lg text-sm font-medium">{error}</div>}
      {success && <div className="p-3 bg-green-100 text-green-800 rounded-lg text-sm font-medium">{success}</div>}

      {/* Coordinates Display */}
      {coordinates.length > 0 && (
        <div className="mt-6 p-4 bg-white rounded-lg border border-slate-200">
          <h3 className="font-semibold text-slate-800 mb-3">
            Polygon Vertices ({coordinates.length > 1 && coordinates[0] === coordinates[coordinates.length - 1] ? coordinates.length - 1 : coordinates.length})
          </h3>

          <div className="max-h-48 overflow-y-auto space-y-2 mb-4">
            {coordinates.map((coord, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-200">
                <span className="text-sm font-mono text-slate-700">
                  {idx + 1}. ({coord.lat.toFixed(6)}, {coord.lng.toFixed(6)})
                </span>
                <button
                  onClick={() => handleRemovePoint(idx)}
                  className="p-1 hover:bg-red-200 rounded transition-colors"
                  title="Remove point"
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </button>
              </div>
            ))}
          </div>

          {/* Statistics */}
          {centroid && (
            <div className="p-3 bg-blue-50 rounded border border-blue-200 mb-4 text-sm text-slate-700">
              <div>📍 Centroid: ({centroid.lat.toFixed(6)}, {centroid.lng.toFixed(6)})</div>
              <div>📐 Area: {areaKm2.toFixed(2)} km²</div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            {coordinates.length >= 3 && (coordinates[0].lat !== coordinates[coordinates.length - 1].lat || coordinates[0].lng !== coordinates[coordinates.length - 1].lng) && (
              <button
                onClick={handleClosePolygon}
                className="flex-1 py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
              >
                Close Polygon
              </button>
            )}
            <button
              onClick={handleClear}
              className="flex-1 py-2 px-4 bg-slate-400 hover:bg-slate-500 text-white font-semibold rounded-lg transition-colors"
            >
              Clear All
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PolygonUpload;
