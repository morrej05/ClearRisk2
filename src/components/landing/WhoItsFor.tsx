import { Shield, Flame, Building2 } from 'lucide-react';

const personas = [
  {
    icon: Shield,
    title: 'Insurance Risk Surveyors',
    description: 'Create comprehensive risk assessment reports for commercial and industrial properties. Generate consistent, detailed documentation that meets insurance underwriting standards.',
    benefits: ['Faster report turnaround', 'Consistent quality', 'Reduced manual writing'],
  },
  {
    icon: Flame,
    title: 'Fire Safety Consultants',
    description: 'Document fire protection systems, evacuation procedures, and safety compliance. Transform site survey data into professional reports for clients and regulatory bodies.',
    benefits: ['Systematic documentation', 'Professional formatting', 'Time savings'],
  },
  {
    icon: Building2,
    title: 'Property Risk Assessors',
    description: 'Evaluate building conditions, occupancy risks, and protection systems. Turn field observations into structured reports that inform risk management decisions.',
    benefits: ['Structured approach', 'Expert-level output', 'Quick revisions'],
  },
];

export default function WhoItsFor() {
  return (
    <section id="who-its-for" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
            Who It's For
          </h2>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto">
            Built for professionals who need to transform survey data into detailed reports
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {personas.map((persona, index) => {
            const Icon = persona.icon;
            return (
              <div
                key={index}
                className="bg-slate-50 p-8 rounded-xl hover:shadow-lg transition-all"
              >
                <div className="w-14 h-14 bg-slate-900 rounded-xl flex items-center justify-center mb-6">
                  <Icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-2xl font-semibold text-slate-900 mb-4">
                  {persona.title}
                </h3>
                <p className="text-slate-600 leading-relaxed mb-6">
                  {persona.description}
                </p>
                <div className="space-y-2">
                  {persona.benefits.map((benefit, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm text-slate-700">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
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
