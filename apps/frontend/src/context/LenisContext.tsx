import { createContext, useContext } from "react";

type ScrollToFn = (target: string | number | Element, opts?: { offset?: number }) => void;

const LenisContext = createContext<ScrollToFn | null>(null);

export const LenisProvider = LenisContext.Provider;

export function useLenisScroll(): ScrollToFn {
  return useContext(LenisContext) ?? defaultScrollTo;
}

function defaultScrollTo(target: string | number | Element) {
  if (typeof target === "string" && target.startsWith("#")) {
    const el = document.querySelector(target);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  } else if (typeof target === "number") {
    window.scrollTo({ top: target, behavior: "smooth" });
  }
}
