import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import RecruitmentsPage from "./pages/RecruitmentsPage.tsx";
import RequestAccount from "./pages/RequestAccount.tsx";
import MembersLayout from "./pages/members/MembersLayout.tsx";
import { ThemeProvider } from "./context/ThemeContext.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/recruitments" element={<RecruitmentsPage />} />
          <Route path="/request-account" element={<RequestAccount />} />
          <Route path="/members" element={<MembersLayout />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
