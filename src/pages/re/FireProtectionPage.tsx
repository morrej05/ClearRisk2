useEffect(() => {
  let aborted = false;

  async function redirectToModule() {
    if (!documentId) {
      if (!aborted) setError('No document ID provided');
      return;
    }

    try {
      const tryKeys = ['RE_06_FIRE_PROTECTION', 'RE_04_FIRE_PROTECTION'];

      let moduleInstance: { id: string } | null = null;

      for (const key of tryKeys) {
        const { data, error: queryError } = await supabase
          .from('module_instances')
          .select('id')
          .eq('document_id', documentId)
          .eq('module_key', key)
          .maybeSingle();

        if (queryError) {
          console.error('[FireProtectionPage] Query error:', queryError);
          if (!aborted) setError('Failed to load Fire Protection module');
          return;
        }

        if (data?.id) {
          moduleInstance = data;
          break;
        }
      }

      if (!moduleInstance) {
        if (!aborted) setError('Fire Protection module not found for this document');
        return;
      }

      navigate(`/documents/${documentId}/workspace?m=${moduleInstance.id}`, { replace: true });
    } catch (err) {
      console.error('[FireProtectionPage] Redirect error:', err);
      if (!aborted) setError('An unexpected error occurred');
    }
  }

  redirectToModule();

  return () => {
    aborted = true;
  };
}, [documentId, navigate]);
