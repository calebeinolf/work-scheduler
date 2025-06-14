// src/App.jsx

import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

// --- Import all your page components ---
import Login from "./components/Login";
import SignUp from "./components/SignUp";
import RoleSelection from "./components/RoleSelection";
import CreateCompany from "./components/CreateCompany";
import JoinCompany from "./components/JoinCompany";
import Dashboard from "./components/Dashboard";
import WorkerSetup from "./components/WorkerSetup";

function App() {
  return (
    <Router>
      <Routes>
        {/* --- Authentication Routes --- */}
        <Route path="/signup" element={<SignUp />} />
        <Route path="/login" element={<Login />} />

        {/* --- Setup Routes (after first login) --- */}
        <Route path="/role-selection" element={<RoleSelection />} />
        <Route path="/create-company" element={<CreateCompany />} />
        <Route path="/join-company" element={<JoinCompany />} />
        <Route path="/worker-setup" element={<WorkerSetup />} />

        {/* --- Main Application Route --- */}
        <Route path="/dashboard" element={<Dashboard />} />

        {/* --- Default Route --- */}
        {/* If a user goes to the base URL, it will redirect them to the login page. */}
        <Route path="/" element={<Navigate to="/login" />} />
      </Routes>
    </Router>
  );
}

export default App;
