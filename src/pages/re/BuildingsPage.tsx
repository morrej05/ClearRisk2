import { useParams } from 'react-router-dom';
import BuildingsEditor from '../../components/re/BuildingsEditor';

export default function BuildingsPage() {
  const { id } = useParams<{ id: string }>();
  if (!id) return <div className="p-4">Missing document id</div>;
  return <BuildingsEditor documentId={id} />;
}
