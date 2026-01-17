import { useNavigate } from 'react-router-dom';
import { Zap, X } from 'lucide-react';
import { useState } from 'react';

interface TrialBannerProps {
  feature?: string;
}

export default function TrialBanner({ feature = 'Smart Recommendations' }: TrialBannerProps) {
  const navigate = useNavigate();
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;

  return (
    <div className="bg-gradient-to-r from-slate-900 to-slate-800 border-b border-slate-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="bg-amber-500 rounded-full p-1.5">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-white text-sm font-medium">
                You're on Trial — <span className="text-amber-400">{feature} requires Pro</span>
              </p>
              <p className="text-slate-300 text-xs mt-0.5">
                Upgrade to unlock AI-powered recommendations and advanced features
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/upgrade')}
              className="px-4 py-1.5 bg-white text-slate-900 text-sm font-medium rounded-lg hover:bg-slate-100 transition-colors"
            >
              View Plans
            </button>
            <button
              onClick={() => setIsDismissed(true)}
              className="text-slate-400 hover:text-white transition-colors p-1"
              aria-label="Dismiss banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
