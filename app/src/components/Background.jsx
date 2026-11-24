// Moving grid, two slowly floating lights, and a soft glow that follows the pointer.
import { useEffect, useRef } from "react";

export default function Background() {
  const spot = useRef(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    let raf = 0, x = 0, y = 0;
    const move = (e) => {
      x = e.clientX; y = e.clientY;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (spot.current) spot.current.style.transform = `translate(${x - 320}px, ${y - 320}px)`;
      });
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => { window.removeEventListener("pointermove", move); cancelAnimationFrame(raf); };
  }, []);
  return (
    <div className="bg" aria-hidden="true">
      <div className="bg-grid" />
      <div className="bg-orb a" />
      <div className="bg-orb b" />
      <div ref={spot} className="bg-spot" />
    </div>
  );
}
