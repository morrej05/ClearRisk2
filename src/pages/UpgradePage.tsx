import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../hooks/useTenant';
import { ArrowLeft, Check, Zap, Lock, Users, AlertCircle, CheckCircle } from 'lucide-react';
import { PLAN_LABELS } from '../utils/permissions';
import { supabase } from '../lib/supabase';

export default function UpgradePage() {
  const { user, userPlan } = useAuth();
  const { organisation } = useTenant();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  const plans = [
    {
      id: 'free',
      name: 'Free',
      priceMonthly: 0,
      priceAnnual: 0,
      description: 'Basic features with limited functionality',
      features: [
        'Create and edit surveys',
        'Generate PDF reports',
        'Basic export functionality',
        'Email support',
        'Unlimited viewers',
      ],
      limitations: [
        'No Smart Recommendations',
        'No FRA module',
        'No advanced analytics',
        'No custom branding',
      ],
      editors: 'Unlimited',
      cta: 'Current Plan',
      showCheckout: false,
      highlighted: false,
    },
    {
      id: 'core',
      name: 'Core',
      priceMonthly: 49,
      priceAnnual: 490,
      stripePriceIdMonthly: 'price_core_monthly',
      stripePriceIdAnnual: 'price_core_annual',
      description: 'Essential features for small teams',
      features: [
        'Everything in Free',
        '1 editor seat',
        'Unlimited viewers',
        'Priority email support',
        'Basic branding',
        'Export to PDF',
      ],
      limitations: [
        'No Smart Recommendations',
        'No FRA module',
        'Limited to 1 editor',
      ],
      editors: '1 Editor',
      cta: 'Upgrade to Core',
      showCheckout: true,
      highlighted: false,
    },
    {
      id: 'professional',
      name: 'Professional',
      priceMonthly: 149,
      priceAnnual: 1490,
      stripePriceIdMonthly: 'price_professional_monthly',
      stripePriceIdAnnual: 'price_professional_annual',
      description: 'Advanced features for growing teams',
      features: [
        'Everything in Core',
        '3 editor seats',
        'AI-powered Smart Recommendations',
        'Advanced analytics dashboard',
        'Custom branding',
        'Priority support',
        'FRA module access',
      ],
      limitations: [],
      editors: '3 Editors',
      cta: 'Upgrade to Professional',
      showCheckout: true,
      highlighted: true,
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      priceMonthly: null,
      priceAnnual: null,
      description: 'Complete solution with premium features',
      features: [
        'Everything in Professional',
        '10 editor seats',
        'Both disciplines (Engineering + Assessment)',
        'All bolt-ons included',
        'Dedicated account manager',
        'Custom integrations',
        'Advanced compliance reporting',
        'SLA guarantee',
      ],
      limitations: [],
      editors: '10 Editors',
      cta: 'Contact Sales',
      showCheckout: false,
      highlighted: false,
    },
  ];

  useEffect(() => {
    const sessionStatus = searchParams.get('session_status');
    if (sessionStatus === 'success') {
      setIsPending(true);
      setPendingMessage("We're confirming your subscription. This usually updates within a few seconds.");
      pollForPlanUpdate();
    }
  }, [searchParams]);

  const pollForPlanUpdate = async () => {
    if (!organisation) return;

    const maxRetries = 15;
    let retries = 0;

    const poll = async () => {
      const { data } = await supabase
        .from('organisations')
        .select('plan_type, subscription_status')
        .eq('id', organisation.id)
        .single();

      if (data?.subscription_status === 'active' && data?.plan_type !== userPlan) {
        setIsPending(false);
        setPendingMessage(`You are now on ${PLAN_LABELS[data.plan_type as keyof typeof PLAN_LABELS]}.`);
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
        return;
      }

      retries++;
      if (retries < maxRetries) {
        setTimeout(poll, 1000);
      } else {
        setIsPending(false);
        setPendingMessage("If your plan doesn't update shortly, refresh or contact support.");
      }
    };

    poll();
  };

  const handleUpgrade = async (plan: typeof plans[0]) => {
    if (!plan.showCheckout || !user || !organisation) {
      window.location.href = 'mailto:sales@ezirisk.com';
      return;
    }

    setIsProcessing(true);

    try {
      const priceIdKey = billingCycle === 'monthly'
        ? 'stripePriceIdMonthly'
        : 'stripePriceIdAnnual';

      const priceId = plan[priceIdKey];

      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`;

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId,
          organisationId: organisation.id,
          successUrl: `${window.location.origin}/upgrade?session_status=success`,
          cancelUrl: `${window.location.origin}/upgrade`,
        }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'No checkout URL returned');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Unable to start checkout. Please contact support.');
      setIsProcessing(false);
    }
  };

  const getCurrentPlanLabel = () => {
    if (!userPlan) return 'Loading...';
    return PLAN_LABELS[userPlan] || 'Unknown';
  };

  const getPrice = (plan: typeof plans[0]) => {
    if (plan.priceMonthly === 0) return 'Free';
    if (plan.priceMonthly === null) return 'Custom';

    const price = billingCycle === 'monthly' ? plan.priceMonthly : plan.priceAnnual;
    const period = billingCycle === 'monthly' ? '/mo' : '/yr';

    return `$${price}${period}`;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Upgrade Your Plan</h1>
              <p className="text-sm text-slate-600 mt-0.5">
                Current Plan: <span className="font-medium text-slate-900">{getCurrentPlanLabel()}</span>
                {organisation?.subscription_status && organisation.subscription_status !== 'active' && (
                  <span className="ml-2 text-amber-600">({organisation.subscription_status})</span>
                )}
              </p>
            </div>
          </div>
        </div>
      </header>

      {pendingMessage && (
        <div className={`mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-4`}>
          <div className={`rounded-lg p-4 ${
            isPending
              ? 'bg-blue-50 border border-blue-200'
              : 'bg-green-50 border border-green-200'
          }`}>
            <div className="flex items-center gap-3">
              {isPending ? (
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
              ) : (
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
              )}
              <p className={`text-sm font-medium ${
                isPending ? 'text-blue-900' : 'text-green-900'
              }`}>
                {pendingMessage}
              </p>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-slate-900 mb-3">
            Choose the Perfect Plan for Your Needs
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-6">
            Self-serve upgrade to Core or Professional. Contact us for Enterprise.
          </p>

          <div className="inline-flex items-center gap-2 bg-white rounded-lg p-1 border border-slate-200">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                billingCycle === 'monthly'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                billingCycle === 'annual'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              Annual <span className="text-green-600 ml-1">Save 17%</span>
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-6 mb-12">
          {plans.map((plan) => {
            const isCurrentPlan = plan.id === userPlan;

            return (
              <div
                key={plan.id}
                className={`bg-white rounded-lg shadow-sm border-2 transition-all ${
                  plan.highlighted
                    ? 'border-slate-900 shadow-lg scale-105 md:col-span-1'
                    : 'border-slate-200'
                } ${isCurrentPlan ? 'ring-2 ring-green-500' : ''}`}
              >
                {plan.highlighted && (
                  <div className="bg-slate-900 text-white text-center py-2 rounded-t-lg">
                    <div className="flex items-center justify-center gap-2">
                      <Zap className="w-4 h-4" />
                      <span className="text-xs font-semibold">MOST POPULAR</span>
                    </div>
                  </div>
                )}

                <div className="p-6">
                  <h3 className="text-xl font-bold text-slate-900 mb-1">{plan.name}</h3>
                  <div className="flex items-center gap-2 text-sm text-slate-600 mb-3">
                    <Users className="w-4 h-4" />
                    <span>{plan.editors}</span>
                  </div>
                  <div className="text-3xl font-bold text-slate-900 mb-2">
                    {getPrice(plan)}
                  </div>
                  <p className="text-slate-600 text-sm mb-6">{plan.description}</p>

                  <button
                    onClick={() => handleUpgrade(plan)}
                    disabled={isCurrentPlan || isProcessing}
                    className={`w-full py-2.5 px-4 rounded-lg font-medium transition-colors mb-6 ${
                      isCurrentPlan
                        ? 'bg-green-50 text-green-700 border border-green-200 cursor-default'
                        : plan.highlighted
                        ? 'bg-slate-900 text-white hover:bg-slate-800'
                        : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
                    } ${isProcessing ? 'opacity-50 cursor-wait' : ''}`}
                  >
                    {isCurrentPlan ? 'Current Plan' : isProcessing ? 'Processing...' : plan.cta}
                  </button>

                  <div className="space-y-2.5 mb-6">
                    {plan.features.map((feature, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-xs text-slate-700">{feature}</span>
                      </div>
                    ))}
                  </div>

                  {plan.limitations.length > 0 && (
                    <div className="pt-4 border-t border-slate-200">
                      <div className="space-y-2">
                        {plan.limitations.map((limitation, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <Lock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                            <span className="text-xs text-slate-500">{limitation}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-slate-900 text-white rounded-lg p-8 text-center">
          <h3 className="text-2xl font-bold mb-3">Need Enterprise?</h3>
          <p className="text-slate-300 mb-6 max-w-2xl mx-auto">
            Contact our sales team for enterprise pricing, 10 editor seats, both disciplines, custom integrations, and dedicated support.
          </p>
          <button
            onClick={() => window.location.href = 'mailto:sales@ezirisk.com'}
            className="px-8 py-3 bg-white text-slate-900 font-medium rounded-lg hover:bg-slate-100 transition-colors"
          >
            Contact Sales
          </button>
        </div>
      </main>
    </div>
  );
}
