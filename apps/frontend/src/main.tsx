import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ClerkProvider } from "@clerk/react";
import "./index.css";
import App from "./App.tsx";
import RecruitmentsPage from "./pages/RecruitmentsPage.tsx";
import RequestAccount from "./pages/RequestAccount.tsx";
import { ThemeProvider } from "./context/ThemeContext.tsx";
import ErrorBoundary from "./components/ErrorBoundary";

const MembersLayout = lazy(() => import("./pages/members/MembersLayout.tsx"));
const SubscriberPage = lazy(() => import("./pages/SubscriberPage.tsx"));
const NewsletterEditorPage = lazy(() => import("./pages/NewsletterEditorPage.tsx"));
const UnsubscribePage = lazy(() => import("./pages/UnsubscribePage.tsx"));
const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  console.warn("[Vite] Chunk preload failed, reloading...", event.payload);
  window.location.reload();
});

if (!CLERK_PUBLISHABLE_KEY) {
  console.error("[Clerk] VITE_CLERK_PUBLISHABLE_KEY is missing! Google login will not work.");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/recruitments" element={<RecruitmentsPage />} />
          <Route path="/request-account" element={<RequestAccount />} />
          <Route path="/subscriber" element={
            CLERK_PUBLISHABLE_KEY ? (
              <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} afterSignOutUrl="/subscriber">
                <ErrorBoundary fallback={
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--bg-primary)" }}>
                    <div className="card-doodle" style={{ padding: 24, textAlign: "center", maxWidth: 420 }}>
                      <p style={{ fontSize: 16, fontWeight: 700, color: "#ef4444", margin: "0 0 8px" }}>Something went wrong</p>
                      <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>Failed to load. Please refresh the page.</p>
                    </div>
                  </div>
                }>
                  <Suspense fallback={
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--bg-primary)" }}>
                      <div className="card-doodle" style={{ padding: 24, textAlign: "center" }}>
                        <p style={{ fontSize: 16, fontWeight: 700, margin: "0 0 8px" }}>Loading...</p>
                        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>Please wait.</p>
                      </div>
                    </div>
                  }>
                    <SubscriberPage />
                  </Suspense>
                </ErrorBoundary>
              </ClerkProvider>
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--bg-primary)" }}>
                <div className="card-doodle" style={{ padding: 24, textAlign: "center", maxWidth: 420 }}>
                  <p style={{ fontSize: 16, fontWeight: 700, color: "#ef4444", margin: "0 0 8px" }}>Clerk Not Configured</p>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>VITE_CLERK_PUBLISHABLE_KEY is missing.</p>
                </div>
              </div>
            )
          } />
          <Route path="/subscriber/newsletter" element={
            <ErrorBoundary fallback={
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--bg-primary)" }}>
                <div className="card-doodle" style={{ padding: 24, textAlign: "center", maxWidth: 420 }}>
                  <p style={{ fontSize: 16, fontWeight: 700, color: "#ef4444", margin: "0 0 8px" }}>Something went wrong</p>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>Failed to load. Please refresh the page.</p>
                </div>
              </div>
            }>
              <Suspense fallback={
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--bg-primary)" }}>
                  <div className="card-doodle" style={{ padding: 24, textAlign: "center" }}>
                    <p style={{ fontSize: 16, fontWeight: 700, margin: "0 0 8px" }}>Loading...</p>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>Please wait.</p>
                  </div>
                </div>
              }>
                <NewsletterEditorPage />
              </Suspense>
            </ErrorBoundary>
          } />
          <Route path="/unsubscribe" element={
            <ErrorBoundary fallback={
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--bg-primary)" }}>
                <div className="card-doodle" style={{ padding: 24, textAlign: "center", maxWidth: 420 }}>
                  <p style={{ fontSize: 16, fontWeight: 700, color: "#ef4444", margin: "0 0 8px" }}>Something went wrong</p>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>Failed to load. Please refresh the page.</p>
                </div>
              </div>
            }>
              <Suspense fallback={
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--bg-primary)" }}>
                  <div className="card-doodle" style={{ padding: 24, textAlign: "center" }}>
                    <p style={{ fontSize: 16, fontWeight: 700, margin: "0 0 8px" }}>Loading...</p>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>Please wait.</p>
                  </div>
                </div>
              }>
                <UnsubscribePage />
              </Suspense>
            </ErrorBoundary>
          } />
          <Route path="/members" element={
            CLERK_PUBLISHABLE_KEY ? (
              <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} afterSignOutUrl="/members">
                <ErrorBoundary fallback={
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--bg-primary)" }}>
                    <div className="card-doodle" style={{ padding: 24, textAlign: "center", maxWidth: 420 }}>
                      <p style={{ fontSize: 16, fontWeight: 700, color: "#ef4444", margin: "0 0 8px" }}>Something went wrong</p>
                      <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>Failed to load the members portal. Please refresh the page.</p>
                    </div>
                  </div>
                }>
                  <Suspense fallback={
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--bg-primary)" }}>
                      <div className="card-doodle" style={{ padding: 24, textAlign: "center" }}>
                        <p style={{ fontSize: 16, fontWeight: 700, margin: "0 0 8px" }}>Loading Portal...</p>
                        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>Please wait, this may take a moment.</p>
                      </div>
                    </div>
                  }>
                    <MembersLayout />
                  </Suspense>
                </ErrorBoundary>
              </ClerkProvider>
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--bg-primary)" }}>
                <div className="card-doodle" style={{ padding: 24, textAlign: "center", maxWidth: 420 }}>
                  <p style={{ fontSize: 16, fontWeight: 700, color: "#ef4444", margin: "0 0 8px" }}>Clerk Not Configured</p>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>VITE_CLERK_PUBLISHABLE_KEY is missing. Google login is unavailable.</p>
                </div>
              </div>
            )
          } />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
