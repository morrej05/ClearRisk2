import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabase';
import { sanitizeModuleInstancePayload } from '../../../utils/modulePayloadSanitizer';

interface UseModuleInstanceReturn {
  data: Record<string, any>;
  setData: (next: Record<string, any>) => void;
  patchData: (partial: Record<string, any>) => void;
  save: () => Promise<void>;
  saving: boolean;
  error: string | null;
  loaded: boolean;
}

export function useModuleInstance(instanceId: string | null): UseModuleInstanceReturn {
  const [data, setDataState] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!instanceId) {
      setLoaded(true);
      return;
    }

    let mounted = true;

    async function loadInstance() {
      try {
        const { data: instance, error: loadError } = await supabase
          .from('module_instances')
          .select('data')
          .eq('id', instanceId)
          .single();

        if (loadError) throw loadError;

        if (mounted) {
          setDataState(instance?.data || {});
          setLoaded(true);
        }
      } catch (err) {
        console.error('Error loading module instance:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load module instance');
          setLoaded(true);
        }
      }
    }

    loadInstance();

    return () => {
      mounted = false;
    };
  }, [instanceId]);

  const setData = useCallback((next: Record<string, any>) => {
    setDataState(next);
  }, []);

  const patchData = useCallback((partial: Record<string, any>) => {
    setDataState((prev) => ({ ...prev, ...partial }));
  }, []);

  const save = useCallback(async () => {
    if (!instanceId) {
      setError('No instance ID provided');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const sanitized = sanitizeModuleInstancePayload({ data });

      const { error: saveError } = await supabase
        .from('module_instances')
        .update({ data: sanitized.data })
        .eq('id', instanceId);

      if (saveError) throw saveError;
    } catch (err) {
      console.error('Error saving module instance:', err);
      setError(err instanceof Error ? err.message : 'Failed to save module instance');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [instanceId, data]);

  return {
    data,
    setData,
    patchData,
    save,
    saving,
    error,
    loaded,
  };
}
