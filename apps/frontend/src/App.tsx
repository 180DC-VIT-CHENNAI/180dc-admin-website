import { useEffect, useState, useCallback, lazy, Suspense } from "react";
import "./index.css";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import SmoothScroll from "./components/SmoothScroll";
import PillNav from "./components/PillNav";
import { GrainOverlay } from "./components/DoodleSVG";
import { apiUrl } from "./lib/api";
import { attachCardHover } from "./lib/animations";
import LazyReveal from "./components/LazyReveal";

// Above the fold — static imports, load immediately with the page
import SplashSection from "./sections/SplashSection";
import HeroSection from "./sections/HeroSection";

// Below the fold — React.lazy makes each one its own JS chunk (code splitting).
// Vite will only fetch a chunk when LazyReveal fires for that section.
const GlobalNetworkSection = lazy(() => import("./sections/GlobalNetworkSection"));
const AboutSection = lazy(() => import("./sections/AboutSection"));
const CompletedProjectsSection = lazy(() => import("./sections/CompletedProjectsSection"));
const CaseStudiesSection = lazy(() => import("./sections/CaseStudiesSection"));
const LeadershipSection = lazy(() => import("./sections/LeadershipSection"));
const BlogSection = lazy(() => import("./sections/BlogSection"));
const PartnersSection = lazy(() => import("./sections/PartnersSection"));
const FooterSection = lazy(() => import("./sections/FooterSection"));

const ConsultingFormModal = lazy(() => import("./components/ConsultingFormModal"));
const ConsultingBoy = lazy(() => import("./components/ConsultingBoy"));

gsap.registerPlugin(ScrollTrigger);

function App() {
  const [activeNav, setActiveNav] = useState("#");
  const [showConsultingForm, setShowConsultingForm] = useState(false);
  const openConsultingForm = useCallback(() => setShowConsultingForm(true), []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [caseStudies, setCaseStudies] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [blogPosts, setBlogPosts] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [completedProjects, setCompletedProjects] = useState<any[]>([]);

  // ── Data fetching ─────────────────────────────────────────────────────────
  // Partners removed — logos are now static files in public/partners/
  // managed by src/data/partners.ts, no API call needed
  useEffect(() => {
    async function loadContent() {
      try {
        const [csRes, _tmRes, bpRes, completedRes] = await Promise.all([
          fetch(apiUrl("/api/content/case-studies")).then((r) => r.json()),
          fetch(apiUrl("/api/content/team-members")).then((r) => r.json()),
          fetch(apiUrl("/api/content/blog-posts")).then((r) => r.json()),
          fetch(apiUrl("/api/projects/completed")).then((r) => r.json()),
        ]);
        if (csRes.success) setCaseStudies(csRes.data);
        if (bpRes.success) setBlogPosts(bpRes.data);
        if (completedRes.success) setCompletedProjects(completedRes.data);
      } catch (e) {
        console.error("Failed to load content", e);
      }
    }
    loadContent();
  }, []);

  // ── Nav highlight + global .reveal animations + GPU card hover ────────────
  //
  // A single MutationObserver watches for new DOM nodes so that sections
  // mounted later by LazyReveal still get their reveal animations and
  // card hover effects attached correctly.
  useEffect(() => {
    const NAV_IDS = ["about", "case-studies", "leadership", "blog", "partners"];
    const observedNavEls = new Set<Element>();

    const navObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveNav(`#${entry.target.id}`);
        }
      },
      { rootMargin: "-100px 0px -60% 0px" }
    );

    function animateReveal(el: Element) {
      if (el.getAttribute("data-gsap-reveal")) return;
      el.setAttribute("data-gsap-reveal", "true");
      gsap.fromTo(
        el,
        { y: 50, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: el,
            start: "top 85%",
            toggleActions: "play none none none",
          },
        }
      );
    }

    function scanNewElements() {
      // Attach nav observer to any newly mounted section
      for (const id of NAV_IDS) {
        const el = document.getElementById(id);
        if (el && !observedNavEls.has(el)) {
          observedNavEls.add(el);
          navObserver.observe(el);
        }
      }
      // Animate any .reveal elements not yet seen
      document
        .querySelectorAll<Element>(".reveal:not([data-gsap-reveal])")
        .forEach(animateReveal);
      // Attach GPU-promoted hover to any new .card-doodle elements
      document
        .querySelectorAll<Element>(".card-doodle:not([data-gsap-hover])")
        .forEach(attachCardHover);
    }

    scanNewElements(); // run once for anything already in the DOM

    const mutationObserver = new MutationObserver(scanNewElements);
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      mutationObserver.disconnect();
      navObserver.disconnect();
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  const navItems = [
    { label: "Home", href: "#" },
    { label: "About", href: "#about" },
    { label: "Case Studies", href: "#case-studies" },
    { label: "Leadership", href: "#leadership" },
    { label: "Blog", href: "#blog" },
    { label: "Partners", href: "#partners" },
    { label: "Recruitments", href: "/recruitments" },
    { label: "Post a Blog", href: "/post-blog" },
  ];

  return (
    <SmoothScroll>
      <GrainOverlay />
      <PillNav
        items={navItems}
        activeHref={activeNav}
        logo="/images/official-logo.png"
      />

      {/* ── Above the fold ── static, loads with the page */}
      <SplashSection />
      <HeroSection onWorkWithUs={openConsultingForm} />

      {/* ── Below the fold ──────────────────────────────────────────────────
          LazyReveal defers mounting until the user scrolls near the section.
          React.lazy means the JS chunk isn't even fetched until then.
          Both work together: no download + no mount until needed. */}

      <LazyReveal>
        <Suspense fallback={null}>
          <GlobalNetworkSection />
        </Suspense>
      </LazyReveal>

      <LazyReveal>
        <Suspense fallback={null}>
          <AboutSection />
        </Suspense>
      </LazyReveal>

      <LazyReveal>
        <Suspense fallback={null}>
          <CompletedProjectsSection completedProjects={completedProjects} />
        </Suspense>
      </LazyReveal>

      <LazyReveal>
        <Suspense fallback={null}>
          <CaseStudiesSection caseStudies={caseStudies} />
        </Suspense>
      </LazyReveal>

      <LazyReveal>
        <Suspense fallback={null}>
          <LeadershipSection />
        </Suspense>
      </LazyReveal>

      <LazyReveal>
        <Suspense fallback={null}>
          <BlogSection blogPosts={blogPosts} />
        </Suspense>
      </LazyReveal>

      <LazyReveal>
        <Suspense fallback={null}>
          <PartnersSection />
        </Suspense>
      </LazyReveal>

      <LazyReveal>
        <Suspense fallback={null}>
          <FooterSection />
        </Suspense>
      </LazyReveal>

      <Suspense fallback={null}>
        <ConsultingBoy onRequestConsulting={openConsultingForm} />
      </Suspense>
      <Suspense fallback={null}>
        <ConsultingFormModal
          isOpen={showConsultingForm}
          onClose={() => setShowConsultingForm(false)}
        />
      </Suspense>
    </SmoothScroll>
  );
}

export default App;
