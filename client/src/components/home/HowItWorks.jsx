import { useRef } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion.js';
import { cn } from '../../lib/cn.js';
import { gsap, ScrollTrigger, useGSAP } from '../../lib/gsap.js';

const PREMISE = 'A poisoned chai at a hill-station homestay';
const STEPS = [
  { n: '01', title: 'Describe', body: 'Type any premise: a place, a crime, a mood. Pick Easy, Medium or Hard.' },
  { n: '02', title: 'Investigate', body: 'Read the story, size up the suspects and flip the clue cards to examine them. Hints are there when you are stuck, for a price.' },
  { n: '03', title: 'Accuse', body: 'Name the culprit. You get one shot. The answer stays on the server until you commit, then your detective work is scored.' },
];

const faceLabel = 'font-mono text-[10px] uppercase tracking-[0.2em]';

// The storytelling section. On a desktop with motion it pins to the screen and the scroll drives a three-scene story on
// the right: a premise types itself, a clue card flips, a suspect is stamped ACCUSED. On a phone, or for anyone who
// prefers reduced motion, it is just three readable steps (revealed gently on scroll when motion is allowed).
export function HowItWorks() {
  const root = useRef(null);
  const reduced = useReducedMotion();

  useGSAP(() => {
    if (reduced) return;
    const box = root.current;
    const all = (sel) => [...box.querySelectorAll(sel)];
    const one = (sel) => box.querySelector(sel);
    const mm = gsap.matchMedia();

    mm.add('(min-width: 1024px)', () => {
      const steps = all('[data-step]');
      const typed = one('[data-typed]');
      const scenes = all('[data-scene]');
      const typing = { n: 0 };
      typed.textContent = '';
      steps.forEach((s, i) => { s.dataset.active = String(i === 0); });
      gsap.set(scenes, { autoAlpha: 0 });
      gsap.set(one('[data-scene="1"]'), { autoAlpha: 1 });
      gsap.set(one('[data-flip]'), { transformPerspective: 1000 });

      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: one('[data-how-pin]'),
          start: 'top top',
          end: '+=2200',
          pin: true,
          scrub: 0.6,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: () => {
            const t = tl.time();
            const active = t >= tl.labels.step3 ? 2 : t >= tl.labels.step2 ? 1 : 0;
            steps.forEach((s, i) => { const v = String(i === active); if (s.dataset.active !== v) s.dataset.active = v; });
          },
        },
      });

      tl.addLabel('step1', 0)
        .to(typing, { n: PREMISE.length, duration: 2.2, onUpdate: () => { typed.textContent = PREMISE.slice(0, Math.round(typing.n)); } })
        .fromTo(one('[data-chip-ring]'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.35 })
        .to(one('[data-gen]'), { scale: 1.05, duration: 0.25, yoyo: true, repeat: 1 })
        .addLabel('step2', '>+0.3')
        .to(one('[data-scene="1"]'), { autoAlpha: 0, y: -24, duration: 0.6 }, 'step2')
        .fromTo(one('[data-scene="2"]'), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.6 }, 'step2')
        .to(one('[data-flip]'), { rotateY: 180, duration: 1.4, ease: 'power2.inOut' }, '>+0.2')
        .fromTo(one('[data-plus]'), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: -4, duration: 0.6, ease: 'power2.out' }, '>-0.35')
        .to(one('[data-fill]'), { scaleX: 0.4, duration: 1 }, '<')
        .addLabel('step3', '>+0.5')
        .to(one('[data-scene="2"]'), { autoAlpha: 0, y: -24, duration: 0.6 }, 'step3')
        .fromTo(one('[data-scene="3"]'), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.6 }, 'step3')
        .fromTo(one('[data-pick-ring]'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5 }, '>+0.2')
        .fromTo(one('[data-accused]'), { autoAlpha: 0, scale: 1.9, rotate: -26 }, { autoAlpha: 1, scale: 1, rotate: -9, duration: 0.5, ease: 'back.out(2)' })
        .fromTo(one('[data-verdict]'), { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power2.out' }, '>+0.3')
        .to({}, { duration: 1.2 }); // hold on the finished scene before the page scrolls on

      // if the window is resized below the breakpoint this section reverts to plain steps: undo what we wrote to the DOM
      return () => {
        steps.forEach((s) => { delete s.dataset.active; });
        typed.textContent = PREMISE;
      };
    });

    mm.add('(max-width: 1023px)', () => {
      const steps = all('[data-step]');
      gsap.set(steps, { opacity: 0, y: 28 });
      // reveal the steps one by one as they scroll into view
      const triggers = ScrollTrigger.batch(steps, {
        start: 'top 88%',
        once: true,
        onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out', stagger: 0.12, overwrite: true }),
      });
      return () => triggers.forEach((t) => t.kill());
    });
  }, { scope: root, dependencies: [reduced], revertOnUpdate: true });

  return (
    <section id="how" ref={root} aria-labelledby="how-title" className="scroll-mt-16">
      <div data-how-pin className="relative flex items-center lg:min-h-screen">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-20 lg:grid-cols-2 lg:items-center lg:gap-16 lg:py-0">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-amber">How it works</p>
            <h2 id="how-title" className="mt-3 font-display text-4xl font-black leading-tight tracking-tight sm:text-5xl">
              Three moves. One culprit.
            </h2>
            <ol className="mt-10 space-y-4">
              {STEPS.map((s) => (
                <li
                  key={s.n}
                  data-step
                  className="flex gap-5 rounded-card border border-edge bg-white/[0.03] p-5 data-[active=false]:opacity-40 lg:transition-opacity lg:duration-300 lg:border-transparent lg:bg-transparent lg:px-0 lg:data-[active=true]:border-edge"
                >
                  <span className="font-mono text-sm text-amber">{s.n}</span>
                  <div>
                    <h3 className="font-display text-2xl font-bold">{s.title}</h3>
                    <p className="mt-1.5 text-mist">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* the animated stage: decorative (the steps on the left say everything), desktop with motion only */}
          <div
            aria-hidden="true"
            data-stage
            className={cn('surface-felt relative h-[28.5rem] overflow-hidden p-6 shadow-lamp', reduced ? 'hidden' : 'hidden lg:block')}
          >
            <div data-scene="1" className="absolute inset-6 flex flex-col">
              <p className={cn(faceLabel, 'text-mist')}>Your premise</p>
              <div className="mt-2 min-h-28 rounded-chip border border-edge bg-ink/60 p-4 font-display text-xl leading-snug">
                <span data-typed>{PREMISE}</span>
                <span className="ml-0.5 inline-block h-5 w-0.5 translate-y-0.5 animate-pulse bg-amber" />
              </div>
              <div className="mt-5 flex gap-2">
                {['Easy', 'Medium', 'Hard'].map((d) => (
                  <span key={d} className="relative rounded-chip border border-edge px-4 py-2 text-sm text-mist">
                    {d}
                    {d === 'Medium' && <span data-chip-ring className="absolute inset-0 rounded-chip border border-amber bg-amber/10 shadow-lamp" />}
                  </span>
                ))}
              </div>
              <div className="mt-auto">
                <span data-gen className="inline-block rounded-chip bg-amber px-5 py-3 text-sm font-semibold text-ink shadow-lamp">Generate mystery</span>
              </div>
            </div>

            <div data-scene="2" className="absolute inset-6 flex flex-col justify-center">
              <div className="relative mx-auto w-full max-w-sm">
                <div data-flip className="relative h-56 [transform-style:preserve-3d]">
                  <div className="surface-felt absolute inset-0 flex flex-col justify-between p-5 [backface-visibility:hidden]">
                    <div>
                      <p className={cn(faceLabel, 'text-mist')}>Lounge radiator</p>
                      <p className="mt-1 font-display text-2xl font-bold">Clay-caked slippers</p>
                    </div>
                    <span className="self-start rounded-chip border border-amber/50 px-3 py-1.5 text-sm text-amber">Examine</span>
                  </div>
                  <div className="surface-paper absolute inset-0 p-5 [backface-visibility:hidden]" style={{ transform: 'rotateY(180deg)' }}>
                    <p className={cn(faceLabel, 'text-paper-ink/60')}>Lounge radiator</p>
                    <p className="mt-1 font-display text-2xl font-bold">Clay-caked slippers</p>
                    <p className="mt-3 text-sm leading-snug text-paper-ink/85">Soaked through and smeared with red clay. The paths here are gravel; only the veranda flower bed has red clay.</p>
                  </div>
                </div>
                <span data-plus className="absolute -top-3 right-2 rounded-full border border-moss/50 bg-ink px-3 py-1 font-mono text-xs text-moss">+5 clue found</span>
              </div>
              <div className="mx-auto mt-8 w-full max-w-sm">
                <p className="mb-2 font-mono text-xs text-mist">CLUES FOUND · 2 / 5</p>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div data-fill style={{ transform: 'scaleX(0.2)' }} className="h-full origin-left rounded-full bg-amber" />
                </div>
              </div>
            </div>

            <div data-scene="3" className="absolute inset-6 flex flex-col justify-center">
              <div className="grid grid-cols-3 gap-3">
                {[['Nandini Bisht', 'Cook'], ['Vikram Sood', 'Retired trader'], ['Pooja Menon', 'Trek guide']].map(([name, role], i) => (
                  <div key={name} className="surface-felt relative p-4 text-center">
                    <p className="font-display text-base font-bold leading-tight">{name}</p>
                    <p className={cn(faceLabel, 'mt-1 text-mist')}>{role}</p>
                    {i === 1 && (
                      <>
                        <span data-pick-ring className="absolute inset-0 rounded-card border-2 border-amber shadow-lamp" />
                        <span
                          data-accused
                          style={{ transform: 'rotate(-9deg)' }}
                          className="absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap border-2 border-blood bg-ink px-2 py-0.5 font-mono text-xs tracking-[0.25em] text-blood-soft"
                        >
                          ACCUSED
                        </span>
                      </>
                    )}
                  </div>
                ))}
              </div>
              <div data-verdict className="mt-12 text-center">
                <p className="font-mono text-xs tracking-[0.3em] text-moss">CASE CLOSED</p>
                <p className="mt-1 font-display text-5xl font-black text-moss">SOLVED</p>
                <p className="mt-2 text-sm text-mist">Vikram's slippers and reading glasses gave him away.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
