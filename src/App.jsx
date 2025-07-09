import React, { Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Loader from "./assets/Loader";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

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
    <AuthProvider>
      <Router>
        <Routes>
          {/* --- Public Routes --- */}
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/join-company" element={<JoinCompanyPage />} />
          <Route path="/create-company" element={<CreateCompanyPage />} />

          {/* --- Protected Routes --- */}
          <Route
            path="/schedule"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
