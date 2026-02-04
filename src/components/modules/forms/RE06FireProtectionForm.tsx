import { useState } from 'react';
import FloatingSaveBar from './FloatingSaveBar';
import SectionGrade from '../../SectionGrade';
import { updateSectionGrade } from '../../../utils/sectionGrades';

export default function RE06FireProtectionForm() {
  const [saving, setSaving] = useState(false);
  const [grade, setGrade] = useState(3);

  return (
    <>
      <div style={{ padding: 24 }}>
        <h2>RE06 is compiling</h2>

        <div style={{ marginTop: 12 }}>
          <SectionGrade
            sectionKey="fire_protection"
            sectionTitle="Fire Protection"
            value={grade}
            onChange={(v: number) => {
              setGrade(v);
              // this call is just to prove the import/export works
              updateSectionGrade('test-doc-id', 'fire_protection', v);
            }}
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <button onClick={() => setSaving(!saving)}>Toggle Saving</button>
        </div>
      </div>

      <FloatingSaveBar onSave={() => alert('save')} isSaving={saving} />
    </>
  );
}
