import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export default function CallToAction() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-4xl md:text-5xl font-bold text-neutral-900 mb-6">
          Ready to Streamline Your Fire Risk Reporting?
        </h2>
        <p className="text-xl text-neutral-600 mb-10 max-w-2xl mx-auto">
          Join fire risk professionals using EziRisk to create professional reports faster
        </p>
        <Link
          to="/signin"
          className="inline-flex items-center gap-2 px-8 py-4 bg-primary-600 text-white rounded-lg font-semibold text-lg hover:bg-primary-700 transition-all hover:scale-105 shadow-lg"
        >
          Get Started Now
          <ArrowRight className="w-5 h-5" />
        </Link>
        <p className="mt-6 text-sm text-neutral-500">
          Start with a free account. Upgrade when you need more features.
        </p>
      </div>
    </section>
  );
}
