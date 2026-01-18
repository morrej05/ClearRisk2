import { useNavigate } from 'react-router-dom';
import { Zap, X } from 'lucide-react';
import { useState } from 'react';
import { SubscriptionPlan } from '../utils/permissions';

interface UpgradeBannerProps {
  plan: SubscriptionPlan;
  feature?: string;
}

export default function UpgradeBanner({ plan, feature = 'Smart Recommendations' }: UpgradeBannerProps) {
  const navigate = useNavigate();
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;

  const getMessage = () => {
    switch (plan) {
      case 'free':
        return {
          title: "You're on Free Plan",
          subtitle: `Upgrade to Professional for ${feature} and advanced features`,
        };
      case 'core':
        return {
          title: "You're on Core Plan",
          subtitle: `Upgrade to Professional for ${feature} and 3 editor seats`,
        };
      default:
        return null;
    }
  };

  const message = getMessage();
  if (!message) return null;

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
                {message.title} — <span className="text-amber-400">{message.subtitle}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/upgrade')}
              className="px-4 py-1.5 bg-white text-slate-900 text-sm font-medium rounded-lg hover:bg-slate-100 transition-colors"
            >
              Upgrade Now
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
