import { ScrollProgress } from '../components/effects/ScrollProgress.jsx';
import { ClosingCta } from '../components/home/ClosingCta.jsx';
import { Difficulties } from '../components/home/Difficulties.jsx';
import { Hero } from '../components/home/Hero.jsx';
import { HowItWorks } from '../components/home/HowItWorks.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

export default function Home() {
  useDocumentTitle();
  return (
    <>
      <ScrollProgress />
      <Hero />
      <HowItWorks />
      <Difficulties />
      <ClosingCta />
    </>
  );
}
