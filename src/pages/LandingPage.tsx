import Navbar from '../components/landing/Navbar';
import Hero from '../components/landing/Hero';
import WhatItDoes from '../components/landing/WhatItDoes';
import HowItWorks from '../components/landing/HowItWorks';
import WhoItsFor from '../components/landing/WhoItsFor';
import WhyClearRisk from '../components/landing/WhyClearRisk';
import CallToAction from '../components/landing/CallToAction';
import Footer from '../components/landing/Footer';

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <Hero />
      <WhatItDoes />
      <HowItWorks />
      <WhoItsFor />
      <WhyClearRisk />
      <CallToAction />
      <Footer />
    </div>
  );
}
