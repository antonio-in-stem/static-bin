/**
 * Page-level interaction layer.
 *
 * Native scroll (no Lenis) · Apple's own pages use native. Smooth wheel is
 * added per-browser by the OS/hardware already.
 *
 *   · Scroll progress bar (top of page)
 *   · Section-dot nav with active highlighting
 *   · IntersectionObserver reveal for .reveal elements
 *   · Magnetic buttons (pointer-proximity lean, ≤16 px)
 *   · Subtle parallax on [data-parallax]
 *
 * Everything here short-circuits when prefers-reduced-motion is on.
 */

export function initScroll(): void {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ── scroll progress bar
  const bar = document.querySelector<HTMLElement>(".scroll-indicator");
  if (bar) {
    function update() {
      const h = document.documentElement;
      const scrolled = h.scrollTop;
      const max = h.scrollHeight - h.clientHeight;
      const p = max > 0 ? scrolled / max : 0;
      bar!.style.transform = `scaleX(${p})`;
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
  }

  // ── section dots nav
  const sectNav = document.querySelector<HTMLElement>(".sect-nav");
  if (sectNav) {
    const dots = Array.from(sectNav.querySelectorAll<HTMLAnchorElement>("a"));
    const sections = dots
      .map((d) => {
        const id = d.getAttribute("href")?.slice(1);
        return id ? document.getElementById(id) : null;
      })
      .filter((s): s is HTMLElement => Boolean(s));

    function showNav() {
      if (window.scrollY > 300) sectNav!.classList.add("on");
      else sectNav!.classList.remove("on");
    }
    showNav();
    window.addEventListener("scroll", showNav, { passive: true });

    if (sections.length) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              const id = e.target.id;
              dots.forEach((d) => {
                const active = d.getAttribute("href") === `#${id}`;
                d.classList.toggle("active", active);
              });
            }
          });
        },
        { rootMargin: "-40% 0px -55% 0px", threshold: 0 },
      );
      sections.forEach((s) => io.observe(s));
    }
  }

  // ── reveal on view
  const revealIO = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry, i) => {
        if (!entry.isIntersecting) return;
        const el = entry.target as HTMLElement;
        const delay = Number(el.dataset.revealDelay ?? 0) + i * 30;
        window.setTimeout(() => el.classList.add("in"), delay);
        revealIO.unobserve(el);
      });
    },
    { rootMargin: "-6% 0px -6% 0px", threshold: 0.01 },
  );
  document.querySelectorAll<HTMLElement>(".reveal").forEach((el) => {
    revealIO.observe(el);
  });

  if (reduced) return;

  // ── magnetic buttons
  document.querySelectorAll<HTMLElement>("[data-magnetic]").forEach((el) => {
    const strength = Number(el.dataset.magnetic) || 14;
    let cx = 0, cy = 0;
    let tx = 0, ty = 0;
    let rafId = 0;

    const target = el;

    function onMove(e: PointerEvent) {
      const rect = target.getBoundingClientRect();
      const nx = (e.clientX - (rect.left + rect.width / 2)) / rect.width;
      const ny = (e.clientY - (rect.top + rect.height / 2)) / rect.height;
      tx = nx * strength;
      ty = ny * strength;
      if (!rafId) rafId = requestAnimationFrame(tick);
    }

    function onLeave() {
      tx = 0;
      ty = 0;
      if (!rafId) rafId = requestAnimationFrame(tick);
    }

    function tick() {
      cx += (tx - cx) * 0.16;
      cy += (ty - cy) * 0.16;
      target.style.transform = `translate(${cx.toFixed(2)}px, ${cy.toFixed(2)}px)`;
      if (Math.abs(tx - cx) > 0.1 || Math.abs(ty - cy) > 0.1) {
        rafId = requestAnimationFrame(tick);
      } else {
        rafId = 0;
      }
    }

    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerleave", onLeave);
  });

  // ── pointer-tracked glow on .glow-track elements
  document.querySelectorAll<HTMLElement>(".glow-track").forEach((el) => {
    function onMove(e: PointerEvent) {
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      el.style.setProperty("--mx", `${x}%`);
      el.style.setProperty("--my", `${y}%`);
    }
    el.addEventListener("pointermove", onMove);
  });

  // ── liquid-glass sheen tracks pointer
  document.querySelectorAll<HTMLElement>(".liquid-glass").forEach((el) => {
    function onMove(e: PointerEvent) {
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      el.style.setProperty("--glass-x", `${x}%`);
    }
    function onLeave() {
      el.style.setProperty("--glass-x", `30%`);
    }
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
  });

  // ── parallax on [data-parallax="0.2"] (speed factor)
  const parallaxEls = Array.from(
    document.querySelectorAll<HTMLElement>("[data-parallax]"),
  );
  if (parallaxEls.length) {
    function updateParallax() {
      parallaxEls.forEach((el) => {
        const speed = Number(el.dataset.parallax) || 0.2;
        const rect = el.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        const viewportMid = window.innerHeight / 2;
        const offset = (mid - viewportMid) * -speed;
        el.style.setProperty("--parallax-y", `${offset.toFixed(2)}px`);
      });
    }
    updateParallax();
    window.addEventListener("scroll", updateParallax, { passive: true });
    window.addEventListener("resize", updateParallax);
  }
}

if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initScroll);
  } else {
    initScroll();
  }

  document.addEventListener("astro:page-load", () => {
    initScroll();
  });
}
