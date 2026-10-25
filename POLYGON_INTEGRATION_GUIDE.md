# Integration Guide: PolygonUpload Component

## Quick Start

### 1. Import the Component

In your main analysis/dashboard component (e.g., `AnalysisControl.tsx` or `App.tsx`):

```tsx
import PolygonUpload from './components/PolygonUpload';
```

### 2. Add State for Polygon Coordinates

```tsx
const [polygonCoordinates, setPolygonCoordinates] = useState<Array<{lat: number, lng: number}>>([]);
const [selectedMineral, setSelectedMineral] = useState('gold');
```

### 3. Render the Component

```tsx
<PolygonUpload
  onPolygonLoaded={(coordinates) => {
    console.log('Polygon loaded:', coordinates);
    setPolygonCoordinates(coordinates);
  }}
  onPolygonClosed={() => {
    console.log('Polygon finalized - ready to analyze');
    // Enable the analyze button here
  }}
/>
```

### 4. Update Analysis Request with Polygon

When user clicks "Analyze" button:

```tsx
const handleAnalyze = async () => {
  if (polygonCoordinates.length < 3) {
    alert('Please define a polygon first (minimum 3 points)');
    return;
  }

  // Convert coordinates to [lat, lng] format for API
  const coords = polygonCoordinates.map(c => [c.lat, c.lng]);

  const response = await axios.post('/api/v1/analysis/run', {
    coordinates: coords,
    mineral: selectedMineral,
    name: `${selectedMineral} Analysis`
  });

  console.log('Analysis started:', response.data);
};
```

---

## Full Example Implementation

```tsx
// components/AnalysisPanel.tsx

import React, { useState } from 'react';
import axios from 'axios';
import PolygonUpload from './PolygonUpload';
import { AlertCircle, Play } from 'lucide-react';

interface Coordinate {
  lat: number;
  lng: number;
}

export function AnalysisPanel() {
  const [polygonCoordinates, setPolygonCoordinates] = useState<Coordinate[]>([]);
  const [selectedMineral, setSelectedMineral] = useState('gold');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<string>('');
  const [error, setError] = useState<string>('');

  const mineralDescriptions = {
    gold: 'Iron oxide alteration + quartz structures',
    copper: 'Hydrothermal alteration zones',
    lithium: 'Pegmatite associations',
    rare_earths: 'Alkaline intrusive signatures',
    coal: 'Thermal + sedimentary basin analysis',
    graphite: 'Metamorphic flake deposits + clay minerals'
  };

  const handleAnalyze = async () => {
    try {
      setError('');
      setAnalysisStatus('');

      // Validation
      if (polygonCoordinates.length < 4) {
        // Need 4 because polygon is auto-closed
        setError('Please define a polygon with at least 3 points');
        return;
      }

      setIsAnalyzing(true);
      setAnalysisStatus('Starting analysis...');

      // Convert to API format
      const coords = polygonCoordinates.map(c => [c.lat, c.lng]);

      // Request SA geological context first
      console.log('Fetching SA geological context...');
      const [minLat, minLng] = [
        Math.min(...coords.map((c: any) => c[0])),
        Math.min(...coords.map((c: any) => c[1]))
      ];
      const [maxLat, maxLng] = [
        Math.max(...coords.map((c: any) => c[0])),
        Math.max(...coords.map((c: any) => c[1]))
      ];

      await axios.post('/api/v1/analysis/geological/sa-context', {
        mineral: selectedMineral,
        bbox: [minLat, minLng, maxLat, maxLng]
      });

      setAnalysisStatus('Geological context loaded. Starting prospectivity analysis...');

      // Start main analysis
      const response = await axios.post('/api/v1/analysis/run', {
        coordinates: coords,
        mineral: selectedMineral,
        name: `${selectedMineral} Analysis - Phase 9`
      });

      setAnalysisStatus(`Analysis started: Job ID ${response.data.job_id}`);
      console.log('Analysis job:', response.data);

      // Poll for results
      const jobId = response.data.job_id;
      pollAnalysisStatus(jobId);

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Analysis failed';
      setError(message);
      setAnalysisStatus('');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const pollAnalysisStatus = (jobId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await axios.get(`/api/v1/analysis/status/${jobId}`);
        
        if (response.data.status === 'complete') {
          clearInterval(pollInterval);
          setAnalysisStatus('Analysis complete! View results below.');
        } else {
          setAnalysisStatus(`Analysis in progress: ${response.data.status}`);
        }
      } catch (err) {
        console.error('Poll error:', err);
      }
    }, 5000); // Poll every 5 seconds
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-lg shadow-2xl border border-slate-700">
      {/* Header */}
      <h1 className="text-3xl font-bold text-slate-100 mb-6">
        Mineral Prospectivity Analysis - Phase 9
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Polygon Definition */}
        <div className="lg:col-span-2">
          <PolygonUpload
            onPolygonLoaded={(coordinates) => {
              console.log('✓ Polygon loaded with', coordinates.length, 'points');
              setPolygonCoordinates(coordinates);
              setError('');
            }}
            onPolygonClosed={() => {
              console.log('✓ Polygon finalized and ready for analysis');
            }}
          />
        </div>

        {/* Right: Analysis Controls */}
        <div className="p-6 bg-slate-800 rounded-lg border border-slate-700 space-y-4">
          <h2 className="text-xl font-bold text-slate-100">Analysis Options</h2>

          {/* Mineral Selection */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Target Mineral
            </label>
            <select
              value={selectedMineral}
              onChange={(e) => setSelectedMineral(e.target.value)}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="gold">Gold (Au)</option>
              <option value="copper">Copper (Cu)</option>
              <option value="lithium">Lithium (Li)</option>
              <option value="rare_earths">Rare Earths (REE)</option>
              <option value="coal">Coal</option>
              <option value="graphite">Graphite (C)</option>
            </select>
            <p className="text-xs text-slate-400 mt-2">
              {mineralDescriptions[selectedMineral as keyof typeof mineralDescriptions]}
            </p>
          </div>

          {/* Status Display */}
          <div className="p-3 bg-slate-700 rounded border border-slate-600">
            <div className="text-sm text-slate-300 space-y-1">
              <div className="font-semibold">Polygon Status:</div>
              <div className="text-slate-400">
                {polygonCoordinates.length > 0
                  ? `✓ ${polygonCoordinates.length - 1} vertices loaded`
                  : '○ No polygon loaded'}
              </div>
            </div>
          </div>

          {/* Analyze Button */}
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || polygonCoordinates.length < 4}
            className={`w-full py-3 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors ${
              isAnalyzing || polygonCoordinates.length < 4
                ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            <Play className="w-5 h-5" />
            {isAnalyzing ? 'Analyzing...' : 'Start Analysis'}
          </button>

          {/* Status Messages */}
          {analysisStatus && (
            <div className="p-3 bg-blue-900 text-blue-200 rounded border border-blue-700 text-sm">
              {analysisStatus}
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-900 text-red-200 rounded border border-red-700 text-sm flex gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* Data Sources */}
          <div className="p-3 bg-slate-700 rounded border border-slate-600 text-xs text-slate-400 space-y-1">
            <div className="font-semibold text-slate-300">Data Sources:</div>
            <div>📡 Sentinel-2 (Copernicus)</div>
            <div>🗺️ CGS Lithology 1:250k</div>
            <div>💾 Mintek Mineral Systems</div>
            <div>📍 DMRE Known Deposits</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-slate-700 text-xs text-slate-400">
        <p>
          This analysis integrates real satellite data (Sentinel-2), South African geological mapping
          (CGS/Mintek/DMRE), and machine learning to generate mineral prospectivity targets and ranked
          borehole recommendations.
        </p>
      </div>
    </div>
  );
}

export default AnalysisPanel;
```

---

## Styling Notes

The `PolygonUpload` component uses Tailwind CSS classes. Ensure your project has Tailwind configured:

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

---

## Accessing Loaded Polygon Data

After polygon is loaded, access it via state:

```tsx
// coordinates format: Array<{ lat: number, lng: number }>
console.log(polygonCoordinates);

// Convert to GeoJSON for mapping:
const geoJSON = {
  type: 'Feature',
  geometry: {
    type: 'Polygon',
    coordinates: [
      polygonCoordinates.map(c => [c.lng, c.lat]) // Note: GeoJSON uses [lng, lat]
    ]
  }
};

// For API calls, convert to analysis format:
const analysisCoords = polygonCoordinates.map(c => [c.lat, c.lng]);
```

---

## Troubleshooting

**Issue:** "Component not found"
- **Solution:** Ensure file is in correct path: `components/PolygonUpload.tsx`

**Issue:** "Tailwind styles not applied"
- **Solution:** Check `tailwind.config.js` includes component paths

**Issue:** "CSV upload fails"
- **Solution:** Verify backend is running and `/api/v1/analysis/polygons/upload-csv` is accessible

**Issue:** "Manual points not saving"
- **Solution:** Check browser console for API errors; verify session ID is consistent

**Issue:** "Polygon validation fails"
- **Solution:** Ensure minimum 3 points; check coordinates are valid WGS84

---

## Performance Tips

1. **Limit polygon size:** Warn users if area > 10,000 km²
2. **Debounce point entry:** Avoid rapid API calls during manual input
3. **Cache geological data:** Reuse CGS/DMRE responses for same bbox
4. **Lazy load map:** Don't render full map until polygon selected

---

## Next Steps

1. Integrate `PolygonUpload` into your existing `AnalysisControl.tsx`
2. Update analysis submission to use polygon coordinates
3. Add geological context display (CGS lithology WMS)
4. Test CSV upload with sample file
5. Test manual point entry workflow
6. Verify borehole enhancement with DMRE data

