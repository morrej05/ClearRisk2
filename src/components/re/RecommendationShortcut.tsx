import { useNavigate } from 'react-router-dom';
import { FileText, Plus } from 'lucide-react';

interface RecommendationShortcutProps {
  documentId: string;
  sourceModuleKey: string;
  sourceModuleLabel: string;
  className?: string;
}

/**
 * Reusable shortcut button to navigate to RE-09 Recommendations
 * and pre-fill the "Add Manual Recommendation" form with the source module.
 */
export default function RecommendationShortcut({
  documentId,
  sourceModuleKey,
  sourceModuleLabel,
  className = '',
}: RecommendationShortcutProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    // Navigate to the document workspace with RE-09 Recommendations module selected
    // Store the source module info in sessionStorage so RE-09 can pre-fill the form
    sessionStorage.setItem('re_add_rec_source', JSON.stringify({
      sourceModuleKey,
      sourceModuleLabel,
    }));

    // Find the RE-09 module ID and navigate
    navigate(`/documents/${documentId}/workspace?openAddRec=true`);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors ${className}`}
    >
      <Plus className="w-4 h-4" />
      <FileText className="w-4 h-4" />
      <span>Raise Recommendation</span>
    </button>
  );
}
