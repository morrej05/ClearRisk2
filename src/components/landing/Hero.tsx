import { Link } from 'react-router-dom';
import { ArrowRight, Shield } from 'lucide-react';

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-900 via-primary-800 to-neutral-900">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-20"></div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 text-center">
        <div className="flex items-center justify-center gap-3 mb-6">
          <Shield className="w-12 h-12 text-primary-300" />
          <h1 className="text-6xl md:text-7xl font-bold text-white">
            EziRisk
          </h1>
        </div>

        <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
          Professional Fire Risk Reporting
          <br />
          <span className="text-primary-200">Made Simple</span>
        </h2>

        <p className="text-xl md:text-2xl text-neutral-200 mb-12 max-w-3xl mx-auto leading-relaxed">
          Structured surveys • Professional reports • Recommendation library • Smart recommendations
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link
            to="/signin"
            className="group px-8 py-4 bg-white text-primary-700 rounded-lg font-semibold text-lg hover:bg-neutral-50 transition-all hover:scale-105 flex items-center gap-2 shadow-xl"
          >
            Get Started
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>

          <button
            onClick={() => {
              const element = document.getElementById('how-it-works');
              if (element) element.scrollIntoView({ behavior: 'smooth' });
            }}
            className="px-8 py-4 bg-transparent text-white border-2 border-white/30 rounded-lg font-semibold text-lg hover:bg-white/10 transition-all"
          >
            View Demo
          </button>
        </div>

        <div className="mt-16 flex flex-wrap justify-center gap-8 text-neutral-300 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-success-400 rounded-full"></div>
            <span>Fire Engineering</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-success-400 rounded-full"></div>
            <span>Risk Assessment</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-success-400 rounded-full"></div>
            <span>Professional Reports</span>
          </div>
        </div>
      </div>
    </section>
  );
}
