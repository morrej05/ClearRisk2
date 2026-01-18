import { Flame, Shield } from 'lucide-react';

const personas = [
  {
    icon: Flame,
    title: 'Fire Engineering Consultants',
    description: 'Comprehensive fire property surveys with detailed technical assessments. Create professional reports covering construction, protection systems, and risk factors.',
    benefits: ['Engineering discipline support', 'Technical depth', 'Sector-specific weighting'],
  },
  {
    icon: Shield,
    title: 'Fire Risk Assessment Consultants',
    description: 'FRA compliance reporting with structured risk evaluation. Document findings, recommendations, and action plans in a consistent format.',
    benefits: ['Assessment discipline support', 'Compliance-focused', 'Smart recommendation triggers'],
  },
];

export default function WhoItsFor() {
  return (
    <section id="who-its-for" className="py-24 bg-neutral-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-neutral-900 mb-4">
            Who It's For
          </h2>
          <p className="text-xl text-neutral-600 max-w-3xl mx-auto">
            Built for fire risk professionals who need structured reporting
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {personas.map((persona, index) => {
            const Icon = persona.icon;
            return (
              <div
                key={index}
                className="bg-white p-8 rounded-xl border border-neutral-200 hover:border-primary-300 hover:shadow-lg transition-all"
              >
                <div className="w-14 h-14 bg-primary-600 rounded-xl flex items-center justify-center mb-6">
                  <Icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-2xl font-semibold text-neutral-900 mb-4">
                  {persona.title}
                </h3>
                <p className="text-neutral-600 leading-relaxed mb-6">
                  {persona.description}
                </p>
                <div className="space-y-2">
                  {persona.benefits.map((benefit, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm text-neutral-700">
                      <div className="w-1.5 h-1.5 bg-success-500 rounded-full"></div>
                      <span>{benefit}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
