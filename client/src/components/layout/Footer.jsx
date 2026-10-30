const YEAR = new Date().getFullYear(); // read once at load; an impure call during render is flagged by the React lint rules

export function Footer() {
  return (
    <footer className="border-t border-edge">
      <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-8 text-sm text-mist sm:flex-row sm:items-center sm:justify-between">
        <p>© {YEAR} AI Mystery Room</p>
        <p>Every case is invented by AI. Pure fiction, always.</p>
      </div>
    </footer>
  );
}
