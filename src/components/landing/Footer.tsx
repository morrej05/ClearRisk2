import { Link } from 'react-router-dom';

export default function Footer() {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <footer className="bg-slate-900 text-slate-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <h3 className="text-2xl font-bold text-white mb-3">ClearRisk</h3>
            <p className="text-slate-400 mb-4 max-w-md leading-relaxed">
              AI-powered report generation for insurance surveyors and risk assessors.
              Transform survey data into professional documentation in minutes.
            </p>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Navigation</h4>
            <ul className="space-y-2">
              <li>
                <button
                  onClick={() => scrollToSection('how-it-works')}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  How it works
                </button>
              </li>
              <li>
                <button
                  onClick={() => scrollToSection('who-its-for')}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  Who it's for
                </button>
              </li>
              <li>
                <Link
                  to="/signin"
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  Sign in
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold mb-4">Product</h4>
            <ul className="space-y-2">
              <li>
                <span className="text-slate-400">Features</span>
              </li>
              <li>
                <span className="text-slate-400">Pricing</span>
              </li>
              <li>
                <span className="text-slate-400">Support</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-800">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-slate-500">
              © {new Date().getFullYear()} ClearRisk. All rights reserved.
            </p>
            <p className="text-sm text-slate-500">
              AI-generated content should be reviewed by qualified professionals before use.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
