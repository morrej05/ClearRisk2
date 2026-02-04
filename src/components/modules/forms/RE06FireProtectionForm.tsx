import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

export default function RE06FireProtectionForm() {
  const [ok, setOk] = useState(false);

  useEffect(() => {
    async function test() {
      const { error } = await supabase.from('documents').select('id').limit(1);
      setOk(!error);
    }
    test();
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h2>RE06 is compiling</h2>
      <p>Supabase import OK: {ok ? 'YES' : 'NO'}</p>
    </div>
  );
}
