import { Link } from 'react-router-dom';
import { PUBLIC_PRICING_PLANS } from '../../config/publicPricing';

export default function Pricing() {
  return (
    <section id="pricing" className="py-24 bg-neutral-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-neutral-900 mb-4">
            Pricing
          </h2>
          <p className="text-xl text-neutral-600 max-w-3xl mx-auto">
            Clear, scalable plans for teams of every size
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PUBLIC_PRICING_PLANS.map((plan) => (
            <div
              key={plan.id}
              className="bg-white p-8 rounded-xl border border-neutral-200 hover:border-primary-300 hover:shadow-lg transition-all"
            >
              <h3 className="text-2xl font-semibold text-neutral-900 mb-3">{plan.name}</h3>
              <p className="text-3xl font-bold text-primary-700 mb-3">{plan.displayPrice}</p>
              <p className="text-neutral-600 mb-8">{plan.employeeRange}</p>

              <Link
                to={plan.ctaHref}
                className={`inline-flex items-center justify-center w-full px-4 py-3 rounded-lg font-semibold transition-colors ${
                  plan.contactOnly
                    ? 'bg-neutral-900 text-white hover:bg-neutral-800'
                    : 'bg-primary-600 text-white hover:bg-primary-700'
                }`}
              >
                {plan.ctaLabel}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
