import { Navigate, useParams } from 'react-router-dom';

export default function AssessmentToDocumentRedirect() {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return <Navigate to="/assessments" replace />;
  }

  return <Navigate to={`/documents/${id}`} replace />;
}
