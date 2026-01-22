import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface Assessment {
  id: string;
  client_name: string | null;
  site_name: string;
  site_address: string | null;
  type: 'fra' | 'fire_strategy' | 'dsear' | 'wildfire';
  status: 'draft' | 'issued';
  created_at: string;
  updated_at: string;
  assessor_name: string;
  jurisdiction: string;
  issued_at: string | null;
}

export interface AssessmentViewModel {
  id: string;
  clientName: string;
  siteName: string;
  discipline: string;
  type: string;
  status: string;
  updatedAt: Date;
  createdAt: Date;
}

function mapAssessmentToViewModel(assessment: Assessment): AssessmentViewModel {
  const typeMap: Record<string, { display: string; discipline: string }> = {
    fra: { display: 'FRA', discipline: 'Fire' },
    fire_strategy: { display: 'Fire Strategy', discipline: 'Fire' },
    dsear: { display: 'DSEAR', discipline: 'Risk Engineering' },
    wildfire: { display: 'Wildfire', discipline: 'Risk Engineering' },
  };

  const typeInfo = typeMap[assessment.type] || { display: assessment.type.toUpperCase(), discipline: 'Fire' };

  return {
    id: assessment.id,
    clientName: assessment.client_name || '—',
    siteName: assessment.site_name,
    discipline: typeInfo.discipline,
    type: typeInfo.display,
    status: assessment.status.charAt(0).toUpperCase() + assessment.status.slice(1),
    updatedAt: new Date(assessment.updated_at),
    createdAt: new Date(assessment.created_at),
  };
}

export interface UseAssessmentsOptions {
  limit?: number;
  activeOnly?: boolean;
}

export function useAssessments(options: UseAssessmentsOptions = {}) {
  const { limit, activeOnly } = options;
  const { organisation } = useAuth();
  const [assessments, setAssessments] = useState<AssessmentViewModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organisation?.id) {
      setLoading(false);
      return;
    }

    async function fetchAssessments() {
      try {
        setLoading(true);
        setError(null);

        let query = supabase
          .from('assessments')
          .select('*')
          .eq('org_id', organisation.id)
          .order('updated_at', { ascending: false });

        if (activeOnly) {
          query = query.in('status', ['draft']);
        }

        if (limit) {
          query = query.limit(limit);
        }

        const { data, error: fetchError } = await query;

        if (fetchError) throw fetchError;

        const viewModels = (data || []).map(mapAssessmentToViewModel);
        setAssessments(viewModels);
      } catch (err) {
        console.error('Error fetching assessments:', err);
        setError(err instanceof Error ? err.message : 'Failed to load assessments');
      } finally {
        setLoading(false);
      }
    }

    fetchAssessments();
  }, [organisation?.id, limit, activeOnly]);

  return { assessments, loading, error };
}
