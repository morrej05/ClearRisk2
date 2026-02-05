import { useParams, useNavigate } from 'react-router-dom';
import BuildingsEditor from '../../components/re/BuildingsEditor';

export default function BuildingsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  if (!id) return <div className="p-4">Missing document id</div>;

  return (
    <div className="p-4">
      <button
        onClick={() => navigate(`/documents/${id}/workspace`)}
        className="mb-4 px-3 py-2 border rounded"
      >
        ← Back to Modules
      </button>

      <BuildingsEditor documentId={id} />
    </div>
  );
}
