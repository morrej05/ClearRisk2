import { ClipboardList, Wand2, Eye, FileDown } from 'lucide-react';

const steps = [
  {
    number: '01',
    icon: ClipboardList,
    title: 'Enter Survey Data',
    description: 'Complete structured forms with information from your site survey, including building details, occupancy, fire protection, and risk factors.',
  },
  {
    number: '02',
    icon: Wand2,
    title: 'Generate Report',
    description: 'AI analyzes your data and generates a comprehensive draft report with all standard sections required for professional risk assessment.',
  },
  {
    number: '03',
    icon: Eye,
    title: 'Review & Refine',
    description: 'Review each section individually. Regenerate specific sections if needed without affecting the rest of the report. Add your expert insights.',
  },
  {
    number: '04',
    icon: FileDown,
    title: 'Export & Deliver',
    description: 'Download your polished report ready for client delivery. Professional formatting and consistent quality every time.',
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
            How It Works
          </h2>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto">
            From survey to finished report in four simple steps
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={index} className="relative">
                <div className="bg-white p-8 rounded-xl shadow-sm hover:shadow-md transition-shadow h-full">
                  <div className="text-5xl font-bold text-slate-200 mb-4">
                    {step.number}
                  </div>
                  <div className="w-12 h-12 bg-slate-900 rounded-lg flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-3">
                    {step.title}
                  </h3>
                  <p className="text-slate-600 leading-relaxed">
                    {step.description}
                  </p>
                </div>
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-4 w-8 h-0.5 bg-slate-300 z-10"></div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
