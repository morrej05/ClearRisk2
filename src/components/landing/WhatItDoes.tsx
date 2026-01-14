import { FileText, Zap, RefreshCw, Download } from 'lucide-react';

const features = [
  {
    icon: FileText,
    title: 'Structured Data Collection',
    description: 'Input survey data through organized forms covering all aspects of risk assessment, from building details to safety systems.',
  },
  {
    icon: Zap,
    title: 'AI-Powered Draft Generation',
    description: 'Generate comprehensive report drafts instantly using AI that understands insurance and risk assessment terminology.',
  },
  {
    icon: RefreshCw,
    title: 'Section-by-Section Control',
    description: 'Review and regenerate individual sections without affecting the entire report. Perfect for fine-tuning specific areas.',
  },
  {
    icon: Download,
    title: 'Professional Export',
    description: 'Download polished reports ready for client delivery, maintaining consistent formatting and professional standards.',
  },
];

export default function WhatItDoes() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
            What ClearRisk Does
          </h2>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto">
            Streamline your survey reporting workflow from data collection to final delivery
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="p-8 rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-lg transition-all"
              >
                <div className="w-12 h-12 bg-slate-900 rounded-lg flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-3">
                  {feature.title}
                </h3>
                <p className="text-slate-600 leading-relaxed">
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
