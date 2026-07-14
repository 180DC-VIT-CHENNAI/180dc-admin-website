import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ClerkProvider } from "@clerk/react";
import "./index.css";
import App from "./App.tsx";
import RecruitmentsPage from "./pages/RecruitmentsPage.tsx";
import RequestAccount from "./pages/RequestAccount.tsx";
import PostBlog from "./pages/PostBlog.tsx";
import BlogView from "./pages/BlogView.tsx";
import { ThemeProvider } from "./context/ThemeContext.tsx";

const MembersLayout = lazy(() => import("./pages/members/MembersLayout.tsx"));
const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

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
          <Route path="/post-blog" element={<PostBlog />} />
          <Route path="/blog/:slug" element={<BlogView />} />
          <Route path="/members" element={
            CLERK_PUBLISHABLE_KEY ? (
              <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} afterSignOutUrl="/members">
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
