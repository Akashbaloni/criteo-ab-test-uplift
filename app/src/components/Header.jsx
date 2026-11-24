// Top bar: brand, the three section tabs, and the plain / technical switch.
export default function Header({ tabs, tab, onTab, tech, onToggle }) {
  const onKeyDown = (e) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (tab + step + tabs.length) % tabs.length;
    onTab(next);
    requestAnimationFrame(() => document.getElementById(`tab-${next}`)?.focus());
  };
  return (
    <header className="nav">
      <div className="nav-in">
        <div className="brand">
          <span className="logo" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
              <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
            </svg>
          </span>
          <b>Ad impact</b>
          <span className="muted">· Criteo campaign</span>
        </div>
        <div className="tabs" role="tablist" aria-label="Sections" onKeyDown={onKeyDown}>
          {tabs.map((t, i) => (
            <button key={t} id={`tab-${i}`} role="tab" className="tab" aria-selected={tab === i} aria-controls="panel"
              tabIndex={tab === i ? 0 : -1} onClick={() => onTab(i)}>
              {t}
            </button>
          ))}
        </div>
        <button className="tswitch" role="switch" aria-checked={tech} onClick={onToggle}
          title="Switch between plain English and the full statistics">
          Analyst view
          <span className="knob" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
