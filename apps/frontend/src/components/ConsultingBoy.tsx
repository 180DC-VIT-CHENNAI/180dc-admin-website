import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface Props {
  onRequestConsulting: () => void;
}

const SPEECH_BUBBLE_1 =
  'Hi, it looks like you are interested in what we are doing.';

const SPEECH_BUBBLE_2 =
  'If you want free consulting in any topic, please send a request!';

export default function ConsultingBoy({ onRequestConsulting }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const charRef = useRef<HTMLDivElement>(null);
  const bubble1Ref = useRef<HTMLDivElement>(null);
  const bubble2Ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const hasEnteredRef = useRef(false);
  const visibleRef = useRef(false);
  const dismissedRef = useRef(false);
  const [, setStep] = useState(0);

  function slideOut() {
    if (!wrapperRef.current) return;
    gsap.to(wrapperRef.current, {
      x: "-120%",
      duration: 0.5,
      ease: "power3.in",
      onComplete: () => setVisible(false),
    });
  }

  function slideIn() {
    setVisible(true);
    if (wrapperRef.current) {
      gsap.to(wrapperRef.current, { x: 0, duration: 0.6, ease: "power3.out" });
    }
  }

  useEffect(() => {
    const sections = document.querySelectorAll("#about, .projects-section");
    if (sections.length === 0) return;
    if (!wrapperRef.current || !bubble1Ref.current || !bubble2Ref.current) return;

    const tl = gsap.timeline({ paused: true });

    tl.to(wrapperRef.current, { x: 0, duration: 0.8, ease: "power3.out" });
    tl.to(bubble1Ref.current, { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(2)" });
    tl.to({}, { duration: 4 });
    tl.to(bubble1Ref.current, { opacity: 0, scale: 0.8, duration: 0.3 });
    tl.to(bubble2Ref.current, { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(2)" });

    tl.eventCallback("onStart", () => { setStep(0); });

    const st = ScrollTrigger.create({
      trigger: sections[0],
      start: "top 75%",
      onEnter: () => {
        if (dismissedRef.current) return;
        visibleRef.current = true;
        if (!hasEnteredRef.current) {
          hasEnteredRef.current = true;
          setVisible(true);
          tl.play();
        } else if (wrapperRef.current) {
          slideIn();
        }
      },
      onLeaveBack: () => {
        visibleRef.current = false;
        if (wrapperRef.current) {
          gsap.to(wrapperRef.current, { x: "-120%", duration: 0.4, ease: "power3.in", onComplete: () => setVisible(false) });
        }
      },
    });

    const checkInterval = setInterval(() => {
      if (!visibleRef.current) return;
      const b1 = bubble1Ref.current;
      const b2 = bubble2Ref.current;
      if (b1 && b2) {
        const b1Opacity = parseFloat(getComputedStyle(b1).opacity);
        const b2Opacity = parseFloat(getComputedStyle(b2).opacity);
        if (b1Opacity > 0.5) setStep(1);
        else if (b2Opacity > 0.5) setStep(2);
      }
    }, 200);

    return () => {
      st.kill();
      tl.kill();
      clearInterval(checkInterval);
    };
  }, []);

  const bubbleStyle: React.CSSProperties = {
    opacity: 0,
    scale: 0.8,
    position: "absolute",
    bottom: 130,
    left: 80,
    maxWidth: 280,
    background: "var(--surface-elevated)",
    border: "1px solid var(--border-default)",
    borderRadius: "var(--radius-lg)",
    padding: "14px 18px",
    boxShadow: "var(--shadow-elevated)",
    fontFamily: "var(--font-sans)",
    fontSize: 14,
    fontWeight: 400,
    color: "var(--text-primary)",
    lineHeight: 1.5,
    zIndex: 2,
  };

  const tailStyle: React.CSSProperties = {
    position: "absolute",
    left: -8,
    bottom: 20,
    width: 16,
    height: 16,
    background: "var(--surface-elevated)",
    border: "1px solid var(--border-default)",
    borderRight: "none",
    borderTop: "none",
    transform: "rotate(45deg)",
    borderBottomLeftRadius: 4,
  };

  return (
    <div
      ref={wrapperRef}
      className="consulting-boy-wrapper"
      style={{
        position: "fixed",
        left: 20,
        bottom: 30,
        zIndex: 999,
        transform: "translateX(-120%)",
        display: visible ? "block" : "none",
      }}
    >
      <div ref={bubble1Ref} className="consulting-bubble" style={bubbleStyle}>
        <div style={tailStyle} />
        {SPEECH_BUBBLE_1}
      </div>

      <div ref={bubble2Ref} className="consulting-bubble" style={{ ...bubbleStyle, maxWidth: 300 }}>
        <div style={tailStyle} />
        {SPEECH_BUBBLE_2}
        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
          <button
            className="btn"
            style={{ padding: "0.5rem 1.2rem", fontSize: 13 }}
            onClick={() => { onRequestConsulting(); slideOut(); }}
          >
            Send Request
          </button>
          <button
            className="btn outline"
            style={{ padding: "0.5rem 1.2rem", fontSize: 13 }}
            onClick={() => { dismissedRef.current = true; slideOut(); }}
          >
            No Thanks
          </button>
        </div>
      </div>

      <div ref={charRef} className="consulting-boy-char">
        <svg
          width="100"
          height="160"
          viewBox="0 0 100 160"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ display: "block" }}
        >
          <path d="M25 42 C20 28, 30 15, 50 12 C70 9, 80 22, 75 38" stroke="var(--text-primary)" strokeWidth="2.5" fill="#4a3728" />
          <circle cx="50" cy="48" r="22" stroke="var(--text-primary)" strokeWidth="2.5" fill="#fddbc1" />
          <circle cx="40" cy="45" r="4" fill="var(--text-primary)" />
          <circle cx="60" cy="45" r="4" fill="var(--text-primary)" />
          <circle cx="38" cy="43" r="1.5" fill="#fff" />
          <circle cx="58" cy="43" r="1.5" fill="#fff" />
          <ellipse cx="33" cy="53" rx="5" ry="3" fill="#f4a8a8" opacity="0.5" />
          <ellipse cx="67" cy="53" rx="5" ry="3" fill="#f4a8a8" opacity="0.5" />
          <path d="M40 55 Q50 64, 60 55" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" fill="none" />
          <rect x="35" y="68" width="30" height="35" rx="6" stroke="var(--text-primary)" strokeWidth="2.5" fill="var(--accent-primary)" />
          <path d="M35 72 L22 85 L25 90" stroke="var(--text-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M65 72 L78 85 L75 90" stroke="var(--text-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <circle cx="24" cy="90" r="4" stroke="var(--text-primary)" strokeWidth="2" fill="#fddbc1" />
          <circle cx="76" cy="90" r="4" stroke="var(--text-primary)" strokeWidth="2" fill="#fddbc1" />
          <rect x="38" y="103" width="8" height="30" rx="3" stroke="var(--text-primary)" strokeWidth="2" fill="#4a7cbf" />
          <rect x="54" y="103" width="8" height="30" rx="3" stroke="var(--text-primary)" strokeWidth="2" fill="#4a7cbf" />
          <ellipse cx="42" cy="136" rx="9" ry="5" stroke="var(--text-primary)" strokeWidth="2" fill="var(--text-primary)" />
          <ellipse cx="58" cy="136" rx="9" ry="5" stroke="var(--text-primary)" strokeWidth="2" fill="var(--text-primary)" />
        </svg>
      </div>
    </div>
  );
}
