import { useTenant } from '../hooks/useTenant';
import { AlertTriangle, Info } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function BillingStatusBanner() {
  const { organisation } = useTenant();

  if (!organisation) return null;

  const { subscription_status, cancel_at_period_end, stripe_current_period_end, plan_type } = organisation;

  const isPastDue = subscription_status === 'past_due';
  const willCancel = cancel_at_period_end && stripe_current_period_end;

  if (!isPastDue && !willCancel) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        {isPastDue && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-900">
                Payment issue detected
              </p>
              <p className="text-xs text-red-700 mt-1">
                Some Professional features may be restricted until payment is resolved.
              </p>
            </div>
            <Link
              to="/upgrade"
              className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors flex-shrink-0"
            >
              Update Payment
            </Link>
          </div>
        )}

        {willCancel && !isPastDue && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
            <Info className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900">
                Your subscription will end on {formatDate(stripe_current_period_end)}
              </p>
              <p className="text-xs text-amber-700 mt-1">
                You will revert to Core unless renewed. Your existing documents and data will remain accessible.
              </p>
            </div>
            <Link
              to="/upgrade"
              className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors flex-shrink-0"
            >
              Renew Subscription
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
