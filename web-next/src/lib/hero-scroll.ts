/**
 * Hero choreography.
 *
 * The hero visual is a big, glassy "token" floating in front of a
 * radial-gradient mesh. Two motion systems operate at once:
 *
 *   · Idle: each character in the token rides its own sine wave; the
 *     mesh rotates slowly in the background.
 *   · Scroll-linked: the token rotates on the Y axis, scales down, and
 *     translates up; the mesh rotates in the opposite direction and
 *     fades. Driven by Motion's scroll() against the hero bounding box.
 *
 * Honours prefers-reduced-motion by locking idle loops to a steady
 * pose and short-circuiting scroll links.
 */

import { animate, scroll } from "motion";

export function mountHero(): () => void {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const hero = document.querySelector<HTMLElement>("[data-hero]");
  const token = document.querySelector<HTMLElement>("[data-hero-token]");
  const mesh = document.querySelector<HTMLElement>("[data-hero-mesh]");
  const chars = Array.from(
    document.querySelectorAll<HTMLElement>("[data-hero-token] [data-ch]"),
  );

  const cleanups: Array<() => void> = [];

  // ── idle character wave
  if (chars.length && !reduced) {
    chars.forEach((ch, i) => {
      const dur = 3 + (i % 5) * 0.25;
      const delay = i * 0.06;
      const anim = animate(
        ch,
        { y: [0, -6, 0, 4, 0], opacity: [1, 0.85, 1, 0.92, 1] },
        {
          duration: dur,
          delay,
          repeat: Infinity,
          ease: "easeInOut",
        },
      );
      cleanups.push(() => anim.stop());
    });
  }

  // ── idle mesh rotation
  if (mesh && !reduced) {
    const anim = animate(
      mesh,
      { rotate: [0, 360] },
      { duration: 60, repeat: Infinity, ease: "linear" },
    );
    cleanups.push(() => anim.stop());
  }

  // ── scroll-linked: token rotates + shrinks as you leave the hero
  if (hero && token && !reduced) {
    const stop = scroll(
      animate(
        token,
        {
          transform: [
            "perspective(1200px) rotateY(0deg) rotateX(0deg) scale(1) translateY(0px)",
            "perspective(1200px) rotateY(-24deg) rotateX(8deg) scale(0.86) translateY(-40px)",
          ],
          opacity: [1, 0.35],
        },
      ),
      {
        target: hero,
        offset: ["start start", "end start"],
      },
    );
    cleanups.push(() => stop());
  }

  // ── scroll-linked: mesh rotates + fades
  if (hero && mesh && !reduced) {
    const stop = scroll(
      animate(
        mesh,
        {
          scale: [1, 1.4],
          opacity: [1, 0.1],
        },
      ),
      {
        target: hero,
        offset: ["start start", "end start"],
      },
    );
    cleanups.push(() => stop());
  }

  // ── pointer tilt (micro-3D on hover, ≤ 4°)
  if (hero && token && !reduced) {
    let rafId = 0;
    let rx = 0, ry = 0;
    let tx = 0, ty = 0;

    function onMove(e: PointerEvent) {
      const rect = hero!.getBoundingClientRect();
      const nx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
      const ny = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
      tx = ny * -4;   // tilt X based on Y pointer
      ty = nx * 6;    // tilt Y based on X pointer
      if (!rafId) rafId = requestAnimationFrame(tick);
    }

    function tick() {
      rx += (tx - rx) * 0.1;
      ry += (ty - ry) * 0.1;
      token!.style.setProperty("--tilt-x", `${rx.toFixed(2)}deg`);
      token!.style.setProperty("--tilt-y", `${ry.toFixed(2)}deg`);
      if (Math.abs(tx - rx) > 0.05 || Math.abs(ty - ry) > 0.05) {
        rafId = requestAnimationFrame(tick);
      } else {
        rafId = 0;
      }
    }

    hero.addEventListener("pointermove", onMove);
    cleanups.push(() => hero.removeEventListener("pointermove", onMove));
  }

  // ── headline entrance (staggered words)
  const title = document.querySelector<HTMLElement>("[data-hero-title]");
  if (title && !reduced) {
    const words = title.querySelectorAll<HTMLElement>("[data-word]");
    const anim = animate(
      words,
      {
        opacity: [0, 1],
        y: [24, 0],
        filter: ["blur(10px)", "blur(0px)"],
      },
      {
        duration: 0.9,
        delay: (i: number) => 0.05 + i * 0.08,
        ease: [0.2, 0.8, 0.2, 1],
      },
    );
    cleanups.push(() => anim.stop());
  }

  return () => {
    cleanups.forEach((c) => c());
  };
}

if (typeof window !== "undefined") {
  let teardown: (() => void) | null = null;

  function boot() {
    if (teardown) teardown();
    teardown = mountHero();
  }

  if (document.readyState === "complete") boot();
  else window.addEventListener("load", boot, { once: true });

  document.addEventListener("astro:page-load", boot);
  document.addEventListener("astro:before-swap", () => {
    if (teardown) { teardown(); teardown = null; }
  });
}
