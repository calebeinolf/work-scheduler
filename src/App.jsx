// src/App.jsx

import React, { Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Loader from "./assets/Loader";

// Lazy load all page components for better code splitting
const LandingPage = React.lazy(() => import("./pages/LandingPage"));
const CreateCompanyPage = React.lazy(() => import("./pages/CreateCompanyPage"));
const JoinCompanyPage = React.lazy(() => import("./pages/JoinCompanyPage"));
const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const Login = React.lazy(() => import("./pages/Login"));
const SignUp = React.lazy(() => import("./pages/SignUp"));
const HomePage = React.lazy(() => import("./pages/HomePage"));

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
