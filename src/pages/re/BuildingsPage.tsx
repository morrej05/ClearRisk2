import { useParams } from 'react-router-dom';
import BuildingsEditor from '@/components/re/BuildingsEditor';

export default function BuildingsPage() {
  const { documentId } = useParams<{ documentId: string }>();
  if (!documentId) return <div className="p-4">Missing documentId</div>;
  return <BuildingsEditor documentId={documentId} />;
}
