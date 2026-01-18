import { Clock, Target, CheckCircle2, Repeat } from 'lucide-react';

const benefits = [
  {
    icon: Clock,
    title: 'Save Hours Per Report',
    description: 'What used to take hours of writing now takes minutes. Generate comprehensive drafts instantly and focus your time on analysis and insights.',
    stat: '80%',
    statLabel: 'Time Saved',
  },
  {
    icon: Target,
    title: 'Consistent Quality',
    description: 'Every report follows the same professional structure and terminology. Maintain high standards across all your documentation.',
    stat: '100%',
    statLabel: 'Consistency',
  },
  {
    icon: CheckCircle2,
    title: 'Professional Output',
    description: 'AI trained on professional risk assessment language produces reports that meet industry standards and client expectations.',
    stat: 'Expert',
    statLabel: 'Level Quality',
  },
  {
    icon: Repeat,
    title: 'Flexible Regeneration',
    description: 'Not satisfied with a section? Regenerate it independently without losing the rest of your work. Iterate until perfect.',
    stat: 'Unlimited',
    statLabel: 'Revisions',
  },
];

export default function WhyClearRisk() {
  return (
    <section className="py-24 bg-neutral-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Why EziRisk
          </h2>
          <p className="text-xl text-neutral-300 max-w-3xl mx-auto">
            The professional way to create fire risk reports
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <div
                key={index}
                className="bg-neutral-800/50 p-8 rounded-xl border border-neutral-700 hover:border-neutral-600 transition-all"
              >
                <div className="flex items-start gap-6">
                  <div className="w-12 h-12 bg-primary-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold mb-2">
                      {benefit.title}
                    </h3>
                    <p className="text-neutral-300 leading-relaxed mb-4">
                      {benefit.description}
                    </p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-success-400">
                        {benefit.stat}
                      </span>
                      <span className="text-sm text-neutral-400">
                        {benefit.statLabel}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-16 p-8 bg-neutral-800/50 rounded-xl border border-neutral-700 text-center">
          <p className="text-neutral-300 text-lg max-w-3xl mx-auto">
            EziRisk doesn't replace your expertise—it amplifies it. You provide the data and insights,
            we handle the structured reporting and professional formatting.
          </p>
        </div>
      </div>
    </section>
  );
}
