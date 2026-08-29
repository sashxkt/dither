"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { NAV, SKILLS, VINKURA_CASES } from "@/lib/content";
import { greet } from "@/lib/console-egg";
import { DitherStage } from "./DitherStage";
import { Mark } from "./Mark";
import { Scramble } from "./Scramble";

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function Portfolio() {
  const [menuOpen, setMenuOpen] = useState(false);
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false
  );
  const [load, setLoad] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const progressRef = useRef<HTMLSpanElement>(null);

  useEffect(greet, []);

  useEffect(() => {
    document.body.classList.toggle("menu-open", menuOpen);
    return () => document.body.classList.remove("menu-open");
  }, [menuOpen]);

  useEffect(() => {
    if (reducedMotion) return;
    const id = window.setInterval(() => {
      setLoad((prev) => {
        const next = Math.min(100, prev + 7 + Math.random() * 11);
        if (next >= 100) {
          window.clearInterval(id);
          window.setTimeout(() => setLoaded(true), 280);
        }
        return next;
      });
    }, 70);
    return () => window.clearInterval(id);
  }, [reducedMotion]);

  // The dither only exists inside the full-screen windows. When none of
  // them is on screen the whole layer is taken down, so it is not
  // painting behind opaque black for most of the page.
  useEffect(() => {
    const stages = Array.from(document.querySelectorAll(".stage"));
    if (!stages.length) return;
    const visible = new Set<Element>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target);
          else visible.delete(entry.target);
        }
        document.documentElement.dataset.stage = visible.size ? "on" : "off";
        // The header fade is suppressed while the hero is up. See globals.css.
        const hero = document.getElementById("home");
        document.documentElement.dataset.hero = hero && visible.has(hero) ? "1" : "0";
      },
      { rootMargin: "10% 0px" }
    );
    stages.forEach((stage) => io.observe(stage));
    return () => {
      io.disconnect();
      delete document.documentElement.dataset.stage;
      delete document.documentElement.dataset.hero;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const el = progressRef.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let cur = 0;
    let shown = -1;
    const loop = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const target = Math.min(1, Math.max(0, window.scrollY / max));
      cur += (target - cur) * (reduced ? 1 : 0.08);
      // Snap once the ease is inside half a percent, so the loop has a
      // settled state to stop at instead of easing forever.
      if (Math.abs(target - cur) < 0.0005) cur = target;
      const next = Math.round(cur * 100);
      if (next !== shown) {
        shown = next;
        el.textContent = String(next).padStart(3, "0");
      }
      raf = cur === target ? 0 : requestAnimationFrame(loop);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(loop);
    };
    loop();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const closeMenu = () => setMenuOpen(false);
  const loadPct = reducedMotion ? 100 : load;
  const isLoaded = reducedMotion || loaded;

  return (
    <>
      <DitherStage />

      <div className={`loader${isLoaded ? " done" : ""}`}>
        <b>SASHAKT</b>
        <span>loading_ {String(Math.floor(loadPct)).padStart(3, "0")}%</span>
      </div>

      <header className="site-header">
        <a className="brand" href="#home" onClick={closeMenu}>
          <Mark ticks />
          <Scramble className="brand-word" text="Sashakt" hover />
        </a>
        <button className="menu-btn" type="button" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
          <span>Menu</span>
        </button>
      </header>

      <nav className={`nav-overlay${menuOpen ? " open" : ""}`} aria-hidden={!menuOpen}>
        <div className="nav-top">
          <span className="brand-word">Sashakt</span>
          <button className="nav-close" type="button" onClick={closeMenu}>
            Close
          </button>
        </div>
        <div className="nav-list">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} onClick={closeMenu}>
              <span className="n">{item.n}</span>
              {item.label}
              <span className="hint">{item.hint}</span>
            </a>
          ))}
        </div>
        <div className="nav-foot">
          <div className="nav-copy label">© Sashakt 2026</div>
        </div>
      </nav>

      <div className="page">
        <section className="hero stage" id="home" data-section>
          <h1 className="hero-title">
            <Scramble text="Sashakt" view />
          </h1>
          <p className="hero-caption">Here&apos;s what I&apos;ve been up to.</p>
        </section>

        <section className="section" id="about" data-section>
          <div className="section-inner">
            <div className="sec-head">
              <span className="sec-num">01</span>
              <h2 className="sec-title">About</h2>
            </div>
            <div className="about-grid">
              <p className="lede">
                Operational software for healthcare, legal practice and public institutions. Built, deployed and kept running.
              </p>
              <div className="ethos">
                <span className="kicker">Ethos</span>
                <p className="body">
                  I run Techfrien, a consultancy serving over 200 healthcare workers and a number of legal firms, and I am on the founding team at Vinkura. Every system goes into daily use by people who cannot afford downtime, so shipping is where the work starts, not where it ends.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="work" data-section>
          <div className="section-inner">
            <div className="sec-head">
              <span className="sec-num">02</span>
              <h2 className="sec-title">Work</h2>
            </div>
          </div>
        </section>

        {/* Each case opens on a silent full-screen window. The frame
            plays alone, nothing set over it, and only then does the
            name arrive, on solid ground, with the detail around it. */}
        <article className="case-feat" id="vinkura" data-section>
          <div className="stage" aria-hidden="true" />
          <div className="case-detail">
            <div className="case-detail-inner">
              <div className="case-head">
                <span className="tag">Network · GovTech</span>
                <h3 className="case-title">
                  <Scramble text="Vinkura" view />
                </h3>
              </div>
              <p className="lede">
                Operational software for public institutions: duty, evidence, identity and field command.
              </p>
              <div className="case-prose">
                <p className="body">
                  I am on the founding team. Vinkura builds the layer Indian institutions actually run on: offline-first, on-prem, and accountable to the officer using it at three in the morning. Not a command-centre demo, but systems that hold up on a mountain axis with no line back to base.
                </p>
                <p className="body muted">
                  What the team has put in the field, with the numbers each deployment reports:
                </p>
              </div>

              <ul className="case-links">
                {VINKURA_CASES.map((c) => (
                  <li key={c.name}>
                    <a href={c.href} target="_blank" rel="noopener noreferrer">
                      <span className="case-link-name">{c.name}</span>
                      <span className="case-link-where">{c.where}</span>
                      <span className="case-link-note">{c.note}</span>
                      <span className="case-link-figure">{c.figure}</span>
                    </a>
                  </li>
                ))}
              </ul>

              <a className="go" href="https://www.vinkura.in/case-studies" target="_blank" rel="noopener noreferrer">
                All case studies →
              </a>
            </div>
          </div>
        </article>

        <article className="case-feat" id="techfrien" data-section>
          <div className="stage" aria-hidden="true" />
          <div className="case-detail">
            <div className="case-detail-inner">
              <div className="case-head">
                <span className="tag">Product · Healthcare · Legal</span>
                <h3 className="case-title">
                  <Scramble text="Techfrien" view />
                </h3>
              </div>
              <p className="lede">
                A technology consultancy for healthcare and legal practice: systems, deployment and agentic AI.
              </p>
              <div className="case-prose">
                <p className="body">
                  Over 200 healthcare workers do their day on systems Techfrien builds, deploys and keeps running. Not a product handed over at launch: the intake, the records, the workflow that carries a case from the front desk to the day&apos;s close, and the deployment that keeps it all up on the hardware the practice already owns.
                </p>
                <p className="body muted">
                  The same operational layer serves legal firms, pointed at matters, files and deadlines instead of patients and receipts. Built for intermittent connectivity, thin IT budgets, and staff who cannot afford a handbook.
                </p>
              </div>
              <dl className="case-stats">
                <div>
                  <dt>200+ healthcare workers</dt>
                  <dd>Daily use across practices, on systems built and maintained end to end.</dd>
                </div>
                <div>
                  <dt>Workflow management</dt>
                  <dd>Intake, records, queues and the close on one path, not four systems.</dd>
                </div>
                <div>
                  <dt>Agentic AI</dt>
                  <dd>Agents that carry routine steps inside the workflow, judged on work removed.</dd>
                </div>
                <div>
                  <dt>Legal firms</dt>
                  <dd>The same layer pointed at matters, files and deadlines a clerk can run.</dd>
                </div>
              </dl>
              <a className="go" href="mailto:contact@techfrien.com">
                contact@techfrien.com →
              </a>
            </div>
          </div>
        </article>

        {/* The one colour window. The pitch sits in the top-right corner
            so the frame keeps the middle of the screen to itself. */}
        <section className="stage skills" id="skills" data-section>
          <div className="skills-panel">
            <span className="sec-num">03 / Skills</span>
            <h2 className="skills-title">
              Designs and automations that make your business impossible to scroll past.
            </h2>
            <p className="skills-note">
              Most business software is forgettable and most beautiful sites do nothing. I build the
              overlap: interfaces worth looking at, wired to automation that removes real work.
            </p>
            <ul className="skills-list">
              {SKILLS.map((s) => (
                <li key={s.name}>
                  <strong>{s.name}</strong>
                  <span>{s.note}</span>
                </li>
              ))}
            </ul>
            <a className="go" href="mailto:contact@techfrien.com">
              Start a project →
            </a>
          </div>
        </section>

        {/* The hand enters from the top right, so the type sits low and left
            and the frame keeps that whole diagonal to itself. */}
        <section className="stage contact" id="contact" data-section>
          <div className="contact-panel">
            <span className="sec-num">04 / Contact</span>
            <h2 className="contact-title">Reach out.</h2>
            <p className="contact-note">
              If you run a room that cannot go down, write. I will tell you whether I can ship it.
            </p>
            <ul className="contact-routes">
              <li>
                <a href="mailto:sashakt6june@gmail.com">
                  <span className="contact-for">Personal solutions</span>
                  <span className="contact-mail">sashakt6june@gmail.com</span>
                </a>
              </li>
              <li>
                <a href="mailto:founder@vinkura.in">
                  <span className="contact-for">Government &amp; surveillance</span>
                  <span className="contact-mail">founder@vinkura.in</span>
                </a>
              </li>
              <li>
                <a href="mailto:contact@techfrien.com">
                  <span className="contact-for">Healthcare &amp; legal firms</span>
                  <span className="contact-mail">contact@techfrien.com</span>
                </a>
              </li>
            </ul>
          </div>
        </section>

        {/* Closing window. The page has spent five screens demonstrating the
            renderer, so the announcement can be short. */}
        <section className="stage library" id="library" data-section>
          <div className="library-panel">
            <span className="library-eyebrow">npm library, coming soon</span>
            <h2 className="library-title">Ditherfilm</h2>
            <p className="library-note">
              Every backdrop on this page is video, dithered to a grid of dots in real time, which
              means the source resolution barely matters and the files can be tiny. I&apos;m
              packaging it as an open-source npm library, so you can use video the way you use
              images.
            </p>
            <span className="library-cmd">npm i ditherfilm</span>
          </div>
        </section>

        <footer className="site-footer">
          <div className="foot-grid">
            <div className="foot-col">
              <h5>Sections</h5>
              {NAV.map((item) => (
                <a key={item.href} href={item.href}>
                  {item.label}
                </a>
              ))}
            </div>
            <div className="foot-col">
              <h5>Connect</h5>
              <a href="mailto:contact@techfrien.com">Email</a>
              <a href="https://github.com/sashxkt" target="_blank" rel="noopener noreferrer">
                GitHub
              </a>
            </div>
            <div className="foot-col">
              <h5>Practice</h5>
              <a href="#techfrien">Techfrien</a>
              <a href="#vinkura">Vinkura</a>
              <a href="#about">Ethos</a>
            </div>
            <div className="foot-col">
              <h5>Info</h5>
              <p>Founder-developer. Techfrien for healthcare and legal practice; founding team at Vinkura.</p>
            </div>
          </div>
          <div className="foot-bottom">
            <span>© Sashakt 2026</span>
            <span>India</span>
          </div>
        </footer>
      </div>

      <div className="hud-right" aria-hidden="true">
        <span>Scroll</span>
        <span ref={progressRef}>000</span>
      </div>

    </>
  );
}
