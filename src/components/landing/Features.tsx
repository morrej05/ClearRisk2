import { Library, Sparkles, Scale, Shield, FileText, Users } from 'lucide-react';

const features = [
  {
    icon: Library,
    title: 'Recommendation Library',
    description: 'Centralized database of standardized recommendations that can be applied across surveys with smart trigger conditions.',
  },
  {
    icon: Sparkles,
    title: 'Smart Recommendations',
    description: 'AI-powered suggestions automatically triggered based on survey responses and risk factors.',
  },
  {
    icon: Scale,
    title: 'Sector Weightings',
    description: 'Industry-specific risk weighting models tailored to different sectors and property types.',
  },
  {
    icon: Users,
    title: 'Role-Based Access',
    description: 'Admin, surveyor, and viewer roles with platform admin capabilities for managing global settings.',
  },
  {
    icon: FileText,
    title: 'Professional Reports',
    description: 'Combined survey and recommendation reports with customizable branding and export options.',
  },
  {
    icon: Shield,
    title: 'Multiple Frameworks',
    description: 'Support for fire property surveys, FRA, ATEX, and ASEAR assessments with framework-specific forms.',
  },
];

export default function Features() {
  return (
    <section className="py-24 bg-neutral-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-neutral-900 mb-4">
            Powerful Features
          </h2>
          <p className="text-xl text-neutral-600 max-w-3xl mx-auto">
            Everything you need for comprehensive fire risk reporting
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="p-6 bg-white rounded-xl border border-neutral-200 hover:border-primary-300 hover:shadow-lg transition-all"
              >
                <div className="w-12 h-12 bg-primary-600 rounded-lg flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-neutral-900 mb-3">
                  {feature.title}
                </h3>
                <p className="text-neutral-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
