import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

// Stand-in used by pages that are built in later tasks (T-14 to T-17). Sets the title and the single h1 like a real page.
export function PagePlaceholder({ title, eyebrow, documentTitle = title, children }) {
  useDocumentTitle(documentTitle === null ? undefined : documentTitle);
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
      {eyebrow && <p className="font-mono text-xs uppercase tracking-[0.25em] text-amber">{eyebrow}</p>}
      <h1 className="mt-3 font-display text-4xl font-black tracking-tight sm:text-6xl">{title}</h1>
      <div className="mt-4 max-w-prose text-mist">{children}</div>
    </section>
  );
}
