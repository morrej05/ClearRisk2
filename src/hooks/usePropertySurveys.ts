import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export interface PropertySurvey {
  id: string;
  property_name: string | null;
  property_address: string | null;
  summary_text: string | null;
  notes_summary: string | null;
  updated_at: string;
  created_at: string;
}

export function usePropertySurveys({ limit = 5 } = {}) {
  const { user } = useAuth();
  const [surveys, setSurveys] = useState<PropertySurvey[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSurveys = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('survey_reports')
          .select('id, property_name, property_address, summary_text, notes_summary, updated_at, created_at')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(limit);

        if (error) throw error;

        setSurveys(data || []);
      } catch (error) {
        console.error('Error fetching property surveys:', error);
        setSurveys([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSurveys();
  }, [user?.id, limit]);

  return { surveys, loading };
}
