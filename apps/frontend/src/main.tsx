import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import RecruitmentsPage from "./pages/RecruitmentsPage.tsx";
import RequestAccount from "./pages/RequestAccount.tsx";
import { ThemeProvider } from "./context/ThemeContext.tsx";

const MembersLayout = lazy(() => import("./pages/members/MembersLayout.tsx"));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/recruitments" element={<RecruitmentsPage />} />
          <Route path="/request-account" element={<RequestAccount />} />
          <Route path="/members" element={
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
          } />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
