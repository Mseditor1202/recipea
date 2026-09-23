// src/pages/index.js
import LpHeader from "@/features/lp/components/LpHeader";
import HeroSection from "@/features/lp/components/HeroSection";
import ProblemSection from "@/features/lp/components/ProblemSection";
import CycleSection from "@/features/lp/components/CycleSection";

export default function IndexPage() {
  return (
    <>
      <LpHeader />
      <HeroSection />
      <ProblemSection />
      <CycleSection />
    </>
  );
}
