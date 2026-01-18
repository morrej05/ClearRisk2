import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Loader2, Shield } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PLAN_FEATURES, getPlanDisplayName } from '../utils/entitlements';

export default function UpgradeSubscription() {
  const { user, userRole, organisation } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (userRole !== 'admin') {
    navigate('/dashboard');
    return null;
  }

  const handleUpgrade = async (priceId: string) => {
    if (!organisation) {
      setError('Organisation not found');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            priceId,
            organisationId: organisation.id,
            successUrl: `${window.location.origin}/admin?upgrade=success`,
            cancelUrl: `${window.location.origin}/upgrade?canceled=true`,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const { sessionUrl } = await response.json();
      window.location.href = sessionUrl;
    } catch (err) {
      console.error('Upgrade error:', err);
      setError(err instanceof Error ? err.message : 'Failed to start upgrade process');
      setIsLoading(false);
    }
  };

  const coreMonthlyPrice = import.meta.env.VITE_STRIPE_PRICE_CORE_MONTHLY;
  const coreAnnualPrice = import.meta.env.VITE_STRIPE_PRICE_CORE_ANNUAL;
  const proMonthlyPrice = import.meta.env.VITE_STRIPE_PRICE_PRO_MONTHLY;
  const proAnnualPrice = import.meta.env.VITE_STRIPE_PRICE_PRO_ANNUAL;

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8 text-slate-900" />
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Upgrade Subscription</h1>
                <p className="text-sm text-slate-600">Choose your plan</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/admin')}
              className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Admin
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {organisation && (
          <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              Current Plan: <strong>{getPlanDisplayName(organisation.plan_type)}</strong>
              {organisation.subscription_status !== 'active' && organisation.plan_type !== 'enterprise' && (
                <span className="ml-2 text-blue-600">
                  (Status: {organisation.subscription_status})
                </span>
              )}
            </p>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm border-2 border-slate-200 p-8 flex flex-col">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Core</h2>
              <p className="text-slate-600 mb-6">{PLAN_FEATURES.core.description}</p>

              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-600" />
                  <span className="text-slate-700">{PLAN_FEATURES.core.maxEditors} editor</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-600" />
                  <span className="text-slate-700">Basic features</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-600" />
                  <span className="text-slate-700">Bolt-on add-ons available</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-3xl font-bold text-slate-900">$99</span>
                <span className="text-slate-600">/month</span>
              </div>
              <button
                onClick={() => handleUpgrade(coreMonthlyPrice)}
                disabled={isLoading || !coreMonthlyPrice}
                className="w-full px-4 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Upgrade to Core Monthly'
                )}
              </button>

              <div className="flex items-baseline gap-2 mb-2 mt-6">
                <span className="text-3xl font-bold text-slate-900">$990</span>
                <span className="text-slate-600">/year</span>
                <span className="text-sm text-green-600 font-medium">Save 17%</span>
              </div>
              <button
                onClick={() => handleUpgrade(coreAnnualPrice)}
                disabled={isLoading || !coreAnnualPrice}
                className="w-full px-4 py-3 bg-slate-100 text-slate-900 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Upgrade to Core Annual'
                )}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-lg border-2 border-slate-900 p-8 flex flex-col relative">
            <div className="absolute top-0 right-0 px-3 py-1 bg-slate-900 text-white text-xs font-bold rounded-bl-lg rounded-tr-lg">
              RECOMMENDED
            </div>

            <div className="flex-1">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Professional</h2>
              <p className="text-slate-600 mb-6">{PLAN_FEATURES.professional.description}</p>

              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-600" />
                  <span className="text-slate-700">{PLAN_FEATURES.professional.maxEditors} editors</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-600" />
                  <span className="text-slate-700 font-semibold">AI-powered features</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-600" />
                  <span className="text-slate-700">Smart recommendations</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-600" />
                  <span className="text-slate-700">Bolt-on add-ons available</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-3xl font-bold text-slate-900">$299</span>
                <span className="text-slate-600">/month</span>
              </div>
              <button
                onClick={() => handleUpgrade(proMonthlyPrice)}
                disabled={isLoading || !proMonthlyPrice}
                className="w-full px-4 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Upgrade to Professional Monthly'
                )}
              </button>

              <div className="flex items-baseline gap-2 mb-2 mt-6">
                <span className="text-3xl font-bold text-slate-900">$2,990</span>
                <span className="text-slate-600">/year</span>
                <span className="text-sm text-green-600 font-medium">Save 17%</span>
              </div>
              <button
                onClick={() => handleUpgrade(proAnnualPrice)}
                disabled={isLoading || !proAnnualPrice}
                className="w-full px-4 py-3 bg-slate-100 text-slate-900 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Upgrade to Professional Annual'
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-12 max-w-5xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Enterprise</h3>
            <p className="text-slate-600 mb-4">
              Need more editors, custom features, or want to discuss discipline switching?
            </p>
            <p className="text-slate-700 mb-6">
              <strong>{PLAN_FEATURES.enterprise.maxEditors}+ editors</strong> · All Pro features · Discipline switching · Priority support
            </p>
            <button
              onClick={() => window.location.href = 'mailto:sales@clearrisk.com'}
              className="px-6 py-3 bg-white text-slate-900 border-2 border-slate-900 rounded-lg hover:bg-slate-50 transition-colors font-medium"
            >
              Contact Sales
            </button>
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-slate-500">
          <p>All plans include secure payment processing via Stripe.</p>
          <p className="mt-2">Your subscription will renew automatically unless canceled.</p>
        </div>
      </div>
    </div>
  );
}
