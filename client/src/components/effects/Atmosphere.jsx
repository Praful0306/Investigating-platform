// Three fixed, purely decorative layers: warm desk-lamp light, a vignette, and film grain. CSS only, no JS.
export function Atmosphere() {
  return (
    <>
      <div data-atmosphere aria-hidden="true" className="atmo-lamp" />
      <div data-atmosphere aria-hidden="true" className="atmo-vignette" />
      <div data-atmosphere aria-hidden="true" className="atmo-grain" />
    </>
  );
}
