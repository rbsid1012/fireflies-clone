import { Hero } from "@/components/marketing/Hero";
import { AskFred, Faq, Features, FinalCta, HowItWorks } from "@/components/marketing/Sections";

export default function LandingPage() {
  return (
    <main>
      <Hero />
      <Features />
      <HowItWorks />
      <AskFred />
      <Faq />
      <FinalCta />
    </main>
  );
}
