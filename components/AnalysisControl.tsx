import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import axios from 'axios';
import { Loader } from 'lucide-react';

interface AnalysisFormData {
  mineral: 'gold' | 'copper' | 'lithium' | 'rare_earths';
  location_name: string;
  polygon_coordinates: number[][][];
}

interface AnalysisControlProps {
  polygonCoords?: number[][][];
  onAnalysisStart?: () => void;
  onAnalysisComplete?: (results: any) => void;
  onError?: (error: string) => void;
}

export default function AnalysisControl({
  polygonCoords,
  onAnalysisStart,
  onAnalysisComplete,
  onError
}: AnalysisControlProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState('');
  const { register, handleSubmit, watch, formState: { errors } } = useForm<AnalysisFormData>({
    defaultValues: {
      mineral: 'gold',
      location_name: 'Analysis Area',
      polygon_coordinates: polygonCoords || []
    }
  });

  const selectedMineral = watch('mineral');

  const onSubmit = async (data: AnalysisFormData) => {
    try {
      if (!polygonCoords || polygonCoords.length === 0) {
        onError?.('Please draw a polygon on the map first');
        return;
      }

      setIsAnalyzing(true);
      setAnalysisStatus('Initiating analysis...');
      onAnalysisStart?.();

      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/v1/analysis/run`,
        {
          coordinates: polygonCoords,
          mineral: data.mineral,
          name: data.location_name
        }
      );

      setAnalysisStatus(`Analysis queued: ${response.data.job_id}`);

      // Poll for results
      let completed = false;
      let attempts = 0;
      const maxAttempts = 120; // 10 minutes with 5-second intervals

      while (!completed && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        attempts++;

        try {
          const statusResponse = await axios.get(
            `${import.meta.env.VITE_API_URL}/api/v1/analysis/status/${response.data.job_id}`
          );

          if (statusResponse.data.status === 'complete') {
            const resultsResponse = await axios.get(
              `${import.meta.env.VITE_API_URL}/api/v1/analysis/results/${response.data.job_id}`
            );

            setAnalysisStatus('Analysis complete!');
            onAnalysisComplete?.(resultsResponse.data);
            completed = true;
          } else {
            setAnalysisStatus(`Processing... (${attempts * 5}s elapsed)`);
          }
        } catch (error) {
          // Still processing, retry
          setAnalysisStatus(`Processing... (attempt ${attempts})`);
        }
      }

      if (!completed) {
        throw new Error('Analysis timeout - please check backend status');
      }

    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.message || 'Analysis failed';
      setAnalysisStatus(`Error: ${errorMessage}`);
      onError?.(errorMessage);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const mineralDescriptions: Record<string, string> = {
    gold: 'Au - Iron oxide + hydrothermal alteration indicator',
    copper: 'Cu - Porphyry + phyllic alteration zones',
    lithium: 'Li - Clay minerals + pegmatite indicators',
    rare_earths: 'REE - Alkaline complex + REE oxide minerals',
    coal: 'C - Sedimentary basins + vegetation/drainage patterns',
    graphite: 'C - Metamorphic pelites + iron formation associations'
  };

  return (
    <div className="w-full max-w-md bg-white/95 backdrop-blur rounded-xl shadow-xl p-6 border border-white/20">
      <h2 className="text-xl font-bold text-slate-900 mb-4">Mineral Analysis</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Mineral Selection */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Target Mineral
          </label>
          <select
            {...register('mineral')}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="gold">Gold (Au)</option>
            <option value="copper">Copper (Cu)</option>
            <option value="lithium">Lithium (Li)</option>
            <option value="rare_earths">Rare Earths (REE)</option>
            <option value="coal">Coal (C)</option>
            <option value="graphite">Graphite (C)</option>
          </select>
          <p className="text-xs text-slate-600 mt-1">
            {mineralDescriptions[selectedMineral]}
          </p>
        </div>

        {/* Location Name */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Location Name
          </label>
          <input
            {...register('location_name')}
            type="text"
            placeholder="e.g., Pilanesberg East Zone"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Status Message */}
        {analysisStatus && (
          <div className={`p-3 rounded-lg text-sm font-medium ${
            analysisStatus.includes('Error') 
              ? 'bg-red-100 text-red-800' 
              : 'bg-blue-100 text-blue-800'
          }`}>
            {analysisStatus}
          </div>
        )}

        {/* Polygon Status */}
        <div className={`p-3 rounded-lg text-xs ${
          polygonCoords && polygonCoords.length > 0
            ? 'bg-green-100 text-green-800'
            : 'bg-yellow-100 text-yellow-800'
        }`}>
          {polygonCoords && polygonCoords.length > 0
            ? `✓ Polygon defined (${polygonCoords[0]?.length || 0} points)`
            : '⚠ Draw a polygon on the map to start analysis'}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isAnalyzing || !polygonCoords?.length}
          className={`w-full py-2 px-4 rounded-lg font-semibold text-white transition-all ${
            isAnalyzing || !polygonCoords?.length
              ? 'bg-slate-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
          }`}
        >
          {isAnalyzing ? (
            <span className="flex items-center justify-center gap-2">
              <Loader className="animate-spin" size={18} />
              Analyzing...
            </span>
          ) : (
            'Run Analysis'
          )}
        </button>

        {/* Info Box */}
        <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-700 border border-slate-200">
          <p className="font-semibold mb-1">Analysis includes:</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>Real Sentinel-2 satellite imagery</li>
            <li>Spectral mineral indices</li>
            <li>Terrain & structural analysis</li>
            <li>ML prospectivity ranking</li>
            <li>5 borehole recommendations</li>
            <li>Professional PDF report</li>
          </ul>
        </div>
      </form>
    </div>
  );
}
