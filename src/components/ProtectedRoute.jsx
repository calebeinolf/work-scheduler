// filepath: c:\Users\EINOLFCB22\Documents\work-scheduler\src\components\ProtectedRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Loader from "../assets/Loader";

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-dvh w-full flex flex-col gap-2 items-center justify-center">
        <Loader color="blue" />
        <p className="text-gray-400">Authenticating...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
