// src/App.jsx

import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

// Import all the new and existing page components
import LandingPage from "./components/LandingPage";
import CreateCompanyPage from "./components/CreateCompanyPage";
import JoinCompanyPage from "./components/JoinCompanyPage";
import Dashboard from "./components/Dashboard";
import Login from "./components/Login"; // Still useful for returning users

function App() {
  return (
    <Router>
      <Routes>
        {/* New Onboarding and Main Routes */}
        <Route path="/create-company" element={<CreateCompanyPage />} />
        <Route path="/join-company" element={<JoinCompanyPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/login" element={<Login />} />

        {/* The new default route is the landing page */}
        <Route path="/" element={<LandingPage />} />
      </Routes>
    </Router>
  );
}

export default App;
