// src/pages/index.js
import LpHeader from "@/features/lp/components/LpHeader";
import HeroSection from "@/features/lp/components/HeroSection";
import ProblemSection from "@/features/lp/components/ProblemSection";
import CycleSection from "@/features/lp/components/CycleSection";
import FeaturesSection from "@/features/lp/components/FeaturesSection";
import HowItWorksSection from "@/features/lp/components/HowItWorksSection";
import FinalCtaSection from "@/features/lp/components/FinalCtaSection";

export default function IndexPage() {
  return (
    <>
      <LpHeader />
      <HeroSection />
      <ProblemSection />
      <CycleSection />
      <FeaturesSection />
      <HowItWorksSection />
      <FinalCtaSection />
    </>
  );
}
