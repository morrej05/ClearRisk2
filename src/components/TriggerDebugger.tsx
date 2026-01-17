import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AlertCircle, CheckCircle, Search, RefreshCw } from 'lucide-react';

interface TriggerLog {
  id: string;
  survey_id: string;
  section_key: string;
  field_key: string;
  rating_value: string;
  matched_trigger_count: number;
  recommendations_added: number;
  error_message: string | null;
  evaluation_context: any;
  created_at: string;
}

interface SurveyField {
  section_key: string;
  field_key: string;
  rating_value: string;
}

export default function TriggerDebugger() {
  const [logs, setLogs] = useState<TriggerLog[]>([]);
  const [surveyId, setSurveyId] = useState('');
  const [surveyFields, setSurveyFields] = useState<SurveyField[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [isLoadingSurvey, setIsLoadingSurvey] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setIsLoadingLogs(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('trigger_evaluation_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setLogs(data || []);
    } catch (err: any) {
      console.error('Error fetching logs:', err);
      setError(err.message);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const fetchSurveyFields = async () => {
    if (!surveyId.trim()) {
      setError('Please enter a survey ID');
      return;
    }

    setIsLoadingSurvey(true);
    setError(null);
    setSurveyFields([]);

    try {
      const { data, error } = await supabase
        .from('survey_reports')
        .select('form_data')
        .eq('id', surveyId.trim())
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setError('Survey not found');
        return;
      }

      // Extract all graded fields from form_data
      const fields: SurveyField[] = [];
      const formData = data.form_data || {};

      // Iterate through all keys in form_data
      for (const [key, value] of Object.entries(formData)) {
        if (typeof value === 'object' && value !== null) {
          // This might be a section
          const sectionKey = key;
          for (const [fieldKey, fieldValue] of Object.entries(value as Record<string, any>)) {
            // Check if it's a rating field (ends with _rating or has rating values)
            if (
              fieldKey.endsWith('_rating') ||
              (typeof fieldValue === 'string' && ['Poor', 'Inadequate', 'Fair', 'Good', 'Excellent'].includes(fieldValue))
            ) {
              fields.push({
                section_key: sectionKey,
                field_key: fieldKey,
                rating_value: String(fieldValue)
              });
            }
          }
        }
      }

      setSurveyFields(fields);
    } catch (err: any) {
      console.error('Error fetching survey:', err);
      setError(err.message);
    } finally {
      setIsLoadingSurvey(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Trigger Debugger</h2>
        <p className="text-sm text-gray-600 mt-1">
          Debug trigger evaluation and see which fields are being evaluated
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-800">{error}</div>
        </div>
      )}

      {/* Survey Field Inspector */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Survey Field Inspector</h3>
        <p className="text-sm text-gray-600 mb-4">
          Enter a survey ID to see all graded fields and their values
        </p>

        <div className="flex gap-3 mb-4">
          <input
            type="text"
            placeholder="Survey ID (UUID)"
            value={surveyId}
            onChange={(e) => setSurveyId(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={fetchSurveyFields}
            disabled={isLoadingSurvey || !surveyId.trim()}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            <Search className="w-4 h-4" />
            {isLoadingSurvey ? 'Loading...' : 'Inspect'}
          </button>
        </div>

        {surveyFields.length > 0 && (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Section Key</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Field Key</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Rating Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {surveyFields.map((field, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900 font-mono">{field.section_key}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 font-mono">{field.field_key}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${
                        ['Poor', 'Inadequate'].includes(field.rating_value)
                          ? 'bg-red-100 text-red-800'
                          : field.rating_value === 'Fair'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {field.rating_value}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {surveyFields.length === 0 && !isLoadingSurvey && surveyId && (
          <div className="text-center py-8 text-gray-500">
            No graded fields found in this survey
          </div>
        )}
      </div>

      {/* Evaluation Log */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Trigger Evaluation Log</h3>
            <p className="text-sm text-gray-600 mt-0.5">
              Last 50 trigger evaluations (most recent first)
            </p>
          </div>
          <button
            onClick={fetchLogs}
            disabled={isLoadingLogs}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors disabled:bg-gray-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingLogs ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {isLoadingLogs ? (
          <div className="text-center py-12 text-gray-500">Loading logs...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No evaluation logs yet. Triggers will be logged when surveys are saved.
          </div>
        ) : (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Section</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Field</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Rating</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Matched</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Added</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-mono text-xs">{log.section_key}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-mono text-xs">{log.field_key}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded ${
                          ['poor', 'inadequate'].includes(log.rating_value.toLowerCase())
                            ? 'bg-red-100 text-red-800'
                            : log.rating_value.toLowerCase() === 'fair'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {log.rating_value}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-semibold text-gray-900">{log.matched_trigger_count}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-semibold text-gray-900">{log.recommendations_added}</span>
                      </td>
                      <td className="px-4 py-3">
                        {log.error_message ? (
                          <div className="flex items-center gap-1 text-red-600" title={log.error_message}>
                            <AlertCircle className="w-4 h-4" />
                            <span className="text-xs">Error</span>
                          </div>
                        ) : log.matched_trigger_count > 0 ? (
                          <div className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-xs">Success</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500">No Match</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
