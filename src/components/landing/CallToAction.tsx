import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export default function CallToAction() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
          Ready to Transform Your Survey Reports?
        </h2>
        <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto">
          Stop spending hours on manual report writing. Start creating professional documentation in minutes.
        </p>
        <Link
          to="/signin"
          className="inline-flex items-center gap-2 px-8 py-4 bg-slate-900 text-white rounded-lg font-semibold text-lg hover:bg-slate-800 transition-all hover:scale-105 shadow-lg"
        >
          Get Started Now
          <ArrowRight className="w-5 h-5" />
        </Link>
        <p className="mt-6 text-sm text-slate-500">
          No credit card required. Start generating reports immediately.
        </p>
      </div>
    </section>
  );
}
