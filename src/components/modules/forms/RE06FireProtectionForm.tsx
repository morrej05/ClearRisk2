import FireProtectionForm from "../../re/FireProtectionForm";

interface Document {
  id: string;
  title: string;
  document_type: string;
}

interface ModuleInstance {
  id: string;
  document_id: string;
  outcome: string | null;
  assessor_notes: string;
  data: Record<string, any>;
}

interface RE06FireProtectionFormProps {
  moduleInstance: ModuleInstance;
  document: Document;
  onSaved: () => void;
}

export default function RE06FireProtectionForm({
  moduleInstance,
  document,
  onSaved
}: RE06FireProtectionFormProps) {
  return <FireProtectionForm documentId={document.id} onSaved={onSaved} />;
}
