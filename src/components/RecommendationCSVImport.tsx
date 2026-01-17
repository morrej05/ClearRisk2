import { useState } from 'react';
import { Upload, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ImportResult {
  success: boolean;
  summary: {
    total: number;
    inserted: number;
    updated: number;
    skipped: number;
  };
  errors?: string[];
}

export default function RecommendationCSVImport() {
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parseCSV = (csvText: string) => {
    const lines = csvText.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());

    const data = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;

      const values: string[] = [];
      let currentValue = '';
      let insideQuotes = false;

      for (let j = 0; j < lines[i].length; j++) {
        const char = lines[i][j];

        if (char === '"') {
          insideQuotes = !insideQuotes;
        } else if (char === ',' && !insideQuotes) {
          values.push(currentValue.trim());
          currentValue = '';
        } else {
          currentValue += char;
        }
      }
      values.push(currentValue.trim());

      if (values.length === headers.length) {
        const row: any = {};
        headers.forEach((header, index) => {
          let value = values[index].replace(/^"|"$/g, '');

          if (header === 'default_priority') {
            row[header] = parseInt(value) || 3;
          } else if (header === 'is_active') {
            row[header] = value.toLowerCase() === 'true';
          } else {
            row[header] = value;
          }
        });
        data.push(row);
      }
    }

    return data;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setError(null);
    setResult(null);

    try {
      const csvText = await file.text();
      const csvData = parseCSV(csvText);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/seed-recommendation-templates`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ csvData }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Import failed');
      }

      const resultData = await response.json();
      setResult(resultData);
    } catch (err) {
      console.error('Import error:', err);
      setError(err instanceof Error ? err.message : 'Failed to import CSV');
    } finally {
      setIsImporting(false);
      event.target.value = '';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4">Import Recommendation Templates from CSV</h2>

      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-2">
          Upload a CSV file with the following columns: hazard, description, action, client_response_prompt, category, default_priority, is_active, scope
        </p>
        <p className="text-sm text-gray-500 mb-4">
          The system will automatically insert new templates or update existing ones based on scope, hazard, and description.
        </p>
      </div>

      <div className="mb-6">
        <label
          htmlFor="csv-upload"
          className={`flex items-center justify-center gap-2 px-6 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
            isImporting
              ? 'border-gray-300 bg-gray-50 cursor-not-allowed'
              : 'border-blue-300 hover:border-blue-400 hover:bg-blue-50'
          }`}
        >
          <Upload className={`w-5 h-5 ${isImporting ? 'text-gray-400' : 'text-blue-600'}`} />
          <span className={isImporting ? 'text-gray-400' : 'text-blue-600'}>
            {isImporting ? 'Importing...' : 'Choose CSV File'}
          </span>
        </label>
        <input
          id="csv-upload"
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          disabled={isImporting}
          className="hidden"
        />
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-900">Import Error</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {result && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start gap-2 mb-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-green-900">Import Completed Successfully</p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 mt-4">
            <div className="bg-white p-3 rounded border border-green-200">
              <p className="text-2xl font-bold text-gray-900">{result.summary.total}</p>
              <p className="text-sm text-gray-600">Total Rows</p>
            </div>
            <div className="bg-white p-3 rounded border border-green-200">
              <p className="text-2xl font-bold text-green-600">{result.summary.inserted}</p>
              <p className="text-sm text-gray-600">Inserted</p>
            </div>
            <div className="bg-white p-3 rounded border border-green-200">
              <p className="text-2xl font-bold text-blue-600">{result.summary.updated}</p>
              <p className="text-sm text-gray-600">Updated</p>
            </div>
            <div className="bg-white p-3 rounded border border-green-200">
              <p className="text-2xl font-bold text-gray-600">{result.summary.skipped}</p>
              <p className="text-sm text-gray-600">Skipped</p>
            </div>
          </div>

          {result.errors && result.errors.length > 0 && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="font-semibold text-yellow-900 mb-2">Warnings:</p>
              <ul className="text-sm text-yellow-800 space-y-1">
                {result.errors.slice(0, 5).map((err, idx) => (
                  <li key={idx} className="list-disc list-inside">{err}</li>
                ))}
                {result.errors.length > 5 && (
                  <li className="text-yellow-700">... and {result.errors.length - 5} more</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
