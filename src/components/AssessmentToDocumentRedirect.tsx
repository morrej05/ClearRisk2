import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export default function AssessmentToDocumentRedirect() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (id) {
      navigate(`/documents/${id}`, { replace: true });
    }
  }, [id, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-slate-600">Redirecting...</div>
    </div>
  );
}
