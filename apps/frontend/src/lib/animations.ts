import gsap from "gsap";

/**
 * Attaches a GPU-promoted hover scale animation to any .card-doodle element.
 *
 * will-change: transform is set on mouseenter so the browser creates a
 * dedicated compositor layer for that card. The scale runs entirely on the GPU —
 * the rest of the page layout is never touched.
 *
 * The layer is released (will-change: auto) after the leave animation finishes
 * so GPU memory isn't wasted while the card is idle.
 *
 * data-gsap-hover guards against attaching listeners twice.
 */
export function attachCardHover(card: Element): void {
  if (card.getAttribute("data-gsap-hover")) return;
  card.setAttribute("data-gsap-hover", "true");

  card.addEventListener("mouseenter", () => {
    (card as HTMLElement).style.willChange = "transform";
    gsap.to(card, { scale: 1.02, duration: 0.3, ease: "power2.out" });
  });

  card.addEventListener("mouseleave", () => {
    gsap.to(card, {
      scale: 1,
      duration: 0.3,
      ease: "power2.out",
      onComplete: () => {
        // Release the GPU layer once the animation settles
        (card as HTMLElement).style.willChange = "auto";
      },
    });
  });
}