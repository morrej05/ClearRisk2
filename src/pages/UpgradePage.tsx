import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Check, Zap, Lock } from 'lucide-react';
import { PLAN_LABELS } from '../utils/permissions';

export default function UpgradePage() {
  const { user, userPlan } = useAuth();
  const navigate = useNavigate();

  const plans = [
    {
      id: 'trial',
      name: 'Trial',
      price: 'Free',
      description: 'Get started with basic survey features',
      features: [
        'Create and edit surveys',
        'Generate PDF reports',
        'Basic export functionality',
        'Email support',
      ],
      limitations: [
        'No Smart Recommendations',
        'No FRA module',
        'No advanced analytics',
      ],
      cta: 'Current Plan',
      ctaDisabled: true,
      highlighted: false,
    },
    {
      id: 'pro',
      name: 'Pro',
      price: 'Contact Sales',
      description: 'Advanced features for professional risk assessment',
      features: [
        'Everything in Trial',
        'AI-powered Smart Recommendations',
        'Advanced analytics dashboard',
        'Priority support',
        'Custom branding',
        'Unlimited surveys',
      ],
      limitations: [
        'FRA module not included',
      ],
      cta: 'Upgrade to Pro',
      ctaDisabled: true,
      highlighted: true,
    },
    {
      id: 'pro_fra',
      name: 'Pro FRA',
      price: 'Contact Sales',
      description: 'Complete solution with Fire Risk Assessment module',
      features: [
        'Everything in Pro',
        'Fire Risk Assessment (FRA) module',
        'ATEX / DSEAR frameworks',
        'Dedicated account manager',
        'Custom integrations',
        'Advanced compliance reporting',
      ],
      limitations: [],
      cta: 'Upgrade to Pro FRA',
      ctaDisabled: true,
      highlighted: false,
    },
  ];

  const handleUpgrade = (planId: string) => {
    alert('Billing integration coming soon. Please contact sales for upgrade options.');
  };

  const getCurrentPlanLabel = () => {
    if (!userPlan) return 'Loading...';
    return PLAN_LABELS[userPlan] || 'Unknown';
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
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-900 mb-3">
            Choose the Perfect Plan for Your Needs
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Unlock powerful features with our Pro plans. Billing integration coming soon.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {plans.map((plan) => {
            const isCurrentPlan = plan.id === userPlan;

            return (
              <div
                key={plan.id}
                className={`bg-white rounded-lg shadow-sm border-2 transition-all ${
                  plan.highlighted
                    ? 'border-slate-900 shadow-lg scale-105'
                    : 'border-slate-200'
                } ${isCurrentPlan ? 'ring-2 ring-slate-400' : ''}`}
              >
                {plan.highlighted && (
                  <div className="bg-slate-900 text-white text-center py-2 rounded-t-lg">
                    <div className="flex items-center justify-center gap-2">
                      <Zap className="w-4 h-4" />
                      <span className="text-sm font-semibold">MOST POPULAR</span>
                    </div>
                  </div>
                )}

                <div className="p-6">
                  <h3 className="text-2xl font-bold text-slate-900 mb-2">{plan.name}</h3>
                  <div className="text-3xl font-bold text-slate-900 mb-2">
                    {plan.price}
                  </div>
                  <p className="text-slate-600 text-sm mb-6">{plan.description}</p>

                  <button
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={plan.ctaDisabled || isCurrentPlan}
                    className={`w-full py-3 px-4 rounded-lg font-medium transition-colors mb-6 ${
                      isCurrentPlan
                        ? 'bg-slate-100 text-slate-600 cursor-default'
                        : plan.highlighted
                        ? 'bg-slate-900 text-white hover:bg-slate-800'
                        : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
                    } ${plan.ctaDisabled && !isCurrentPlan ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {isCurrentPlan ? 'Current Plan' : plan.cta}
                  </button>

                  <div className="space-y-3 mb-6">
                    {plan.features.map((feature, idx) => (
                      <div key={idx} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-slate-700">{feature}</span>
                      </div>
                    ))}
                  </div>

                  {plan.limitations.length > 0 && (
                    <div className="pt-4 border-t border-slate-200">
                      <div className="space-y-2">
                        {plan.limitations.map((limitation, idx) => (
                          <div key={idx} className="flex items-start gap-3">
                            <Lock className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
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
          <h3 className="text-2xl font-bold mb-3">Need a Custom Solution?</h3>
          <p className="text-slate-300 mb-6 max-w-2xl mx-auto">
            Contact our sales team for enterprise pricing, custom integrations, and dedicated support.
          </p>
          <button
            onClick={() => alert('Contact: sales@clearrisk.com')}
            className="px-8 py-3 bg-white text-slate-900 font-medium rounded-lg hover:bg-slate-100 transition-colors"
          >
            Contact Sales
          </button>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-slate-500">
            Billing integration with Stripe coming soon. All features are currently available for testing.
          </p>
        </div>
      </main>
    </div>
  );
}
