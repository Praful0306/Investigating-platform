// One place that registers GSAP's plugins (all free), so every component imports from here and nothing is
// registered twice. Only the pages that animate import this file, so the first paint never downloads GSAP.
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);

export { gsap, ScrollTrigger, SplitText, useGSAP };
