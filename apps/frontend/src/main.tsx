import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import { ThemeProvider } from "./context/ThemeContext.tsx";

const RecruitmentsPage = lazy(() => import("./pages/RecruitmentsPage.tsx"));
const RequestAccount = lazy(() => import("./pages/RequestAccount.tsx"));
const MembersLayout = lazy(() => import("./pages/members/MembersLayout.tsx"));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <Suspense fallback={<div className="page-loading" />}>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/recruitments" element={<RecruitmentsPage />} />
            <Route path="/request-account" element={<RequestAccount />} />
            <Route path="/members" element={<MembersLayout />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
