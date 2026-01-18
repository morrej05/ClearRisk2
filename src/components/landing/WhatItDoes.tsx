export default function WhatItDoes() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-neutral-900 mb-4">
            What EziRisk Does
          </h2>
          <p className="text-xl text-neutral-600 max-w-3xl mx-auto">
            A complete fire risk reporting platform for engineering and assessment consultants
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="text-center">
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mb-4 mx-auto">
              <span className="text-2xl font-bold text-primary-700">1</span>
            </div>
            <h3 className="text-xl font-semibold text-neutral-900 mb-2">
              Create Surveys
            </h3>
            <p className="text-neutral-600">
              Structured forms capture all required data for fire property or risk assessments
            </p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mb-4 mx-auto">
              <span className="text-2xl font-bold text-primary-700">2</span>
            </div>
            <h3 className="text-xl font-semibold text-neutral-900 mb-2">
              Add Recommendations
            </h3>
            <p className="text-neutral-600">
              Use the recommendation library with smart triggers or create custom findings
            </p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mb-4 mx-auto">
              <span className="text-2xl font-bold text-primary-700">3</span>
            </div>
            <h3 className="text-xl font-semibold text-neutral-900 mb-2">
              Export Reports
            </h3>
            <p className="text-neutral-600">
              Professional reports combining survey findings and recommendations, ready for clients
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
