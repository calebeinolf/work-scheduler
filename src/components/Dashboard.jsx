// src/components/Dashboard.jsx

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase"; // Make sure this path is correct
import ManagerDashboard from "./ManagerDashboard"; // <-- NEW IMPORT
import WorkerDashboard from "./WorkerDashboard"; // <-- NEW IMPORT

// --- Main Dashboard Component ---

const Dashboard = () => {
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [companyData, setCompanyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // Listen for authentication state changes
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        // If no user is logged in, redirect to login page
        navigate("/login");
        return;
      }

      // Listen for real-time updates to the user document
      const userDocRef = doc(db, "users", user.uid);
      const unsubscribeUser = onSnapshot(
        userDocRef,
        (userDocSnap) => {
          if (!userDocSnap.exists()) {
            setLoading(false);
            navigate("/role-selection");
            return;
          }

          const fetchedUserData = userDocSnap.data();
          setUserData(fetchedUserData);

          // If user has a company, fetch its data
          if (fetchedUserData.companyId) {
            const companyDocRef = doc(
              db,
              "companies",
              fetchedUserData.companyId
            );
            const unsubscribeCompany = onSnapshot(
              companyDocRef,
              (companyDocSnap) => {
                if (companyDocSnap.exists()) {
                  setCompanyData({
                    id: companyDocSnap.id,
                    ...companyDocSnap.data(),
                  });
                } else {
                  setError("Could not find your company's data.");
                }
                setLoading(false); // Data is ready to be passed down
              }
            );
            // Note: In a larger app, you'd manage the cleanup of unsubscribeCompany
          } else {
            // If user has a role but no company, redirect to the appropriate setup page
            setLoading(false);
            if (fetchedUserData.role === "head manager")
              navigate("/create-company");
            else navigate("/join-company");
          }
        },
        (err) => {
          console.error("Error fetching user data:", err);
          setError("Failed to load user data.");
          setLoading(false);
        }
      );

      // Clean up user listener when auth state changes
      return () => unsubscribeUser();
    });

    // Clean up auth listener on component unmount
    return () => unsubscribeAuth();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };

  // --- Render Logic ---
  const renderContent = () => {
    if (loading) {
      return (
        <div className="text-center p-10">
          <p className="text-lg">Loading Dashboard...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center p-10 bg-red-100">
          <p className="text-red-700">{error}</p>
        </div>
      );
    }

    if (userData && companyData) {
      if (userData.role === "head manager") {
        return <ManagerDashboard user={userData} company={companyData} />;
      }
      if (userData.role === "worker") {
        return <WorkerDashboard user={userData} company={companyData} />;
      }
    }

    // Fallback for edge cases where data isn't ready
    return (
      <div className="text-center p-10">
        <p className="text-lg">Initializing...</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm">
        <nav className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
          <h1 className="text-xl font-bold text-blue-600">Scheduler</h1>
          {/* Only show logout button if user data is loaded */}
          {userData && (
            <button
              onClick={handleLogout}
              className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition duration-200"
            >
              Log Out
            </button>
          )}
        </nav>
      </header>

      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        {renderContent()}
      </main>
    </div>
  );
};

export default Dashboard;
