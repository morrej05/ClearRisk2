import { useState } from 'react';
import FloatingSaveBar from './FloatingSaveBar';

export default function RE06FireProtectionForm() {
  const [saving, setSaving] = useState(false);

  return (
    <>
      <div style={{ padding: 24 }}>
        <h2>RE06 is compiling</h2>
        <button onClick={() => setSaving(!saving)}>Toggle Saving</button>
      </div>
      <FloatingSaveBar onSave={() => alert('save')} isSaving={saving} />
    </>
  );
}
