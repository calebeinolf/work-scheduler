// src/App.jsx

import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

// Import all the new and existing page components
import LandingPage from "./pages/LandingPage";
import CreateCompanyPage from "./pages/CreateCompanyPage";
import JoinCompanyPage from "./pages/JoinCompanyPage";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import HomePage from "./pages/HomePage";

function App() {
  return (
    <Router>
      <Routes>
        {/* --- Core App Routes --- */}
        {/* The root path now attempts to load the Dashboard */}
        <Route path="/" element={<HomePage />} />

        {/* --- Onboarding and Auth Routes --- */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/create-company" element={<CreateCompanyPage />} />
        <Route path="/join-company" element={<JoinCompanyPage />} />
        <Route path="/schedule" element={<Dashboard />} />

        {/* Fallback route - could redirect to landing or a 404 page */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
