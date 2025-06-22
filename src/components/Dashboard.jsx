// src/components/Dashboard.jsx

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  query,
  where,
  onSnapshot,
  limit,
  doc,
} from "firebase/firestore"; // <-- FIXED: added 'doc'
import { auth, db } from "../firebase";
import ManagerDashboard from "./ManagerDashboard";
import WorkerDashboard from "./WorkerDashboard";

const Dashboard = () => {
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [companyData, setCompanyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        navigate("/login");
        return;
      }

      // Query for the user's profile document using their auth UID.
      const userQuery = query(
        collection(db, "users"),
        where("authUid", "==", user.uid),
        limit(1)
      );

      const unsubscribeUser = onSnapshot(
        userQuery,
        (querySnapshot) => {
          if (querySnapshot.empty) {
            // No profile exists for this authenticated user.
            // This can happen if they sign up but don't select a role.
            setLoading(false);
            navigate("/role-selection");
            return;
          }

          const userDocSnap = querySnapshot.docs[0];
          const fetchedUserData = { id: userDocSnap.id, ...userDocSnap.data() };
          setUserData(fetchedUserData);

          // Now fetch company data if it exists
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
                setLoading(false);
              }
            );
            // You would manage cleanup of unsubscribeCompany in a real app
          } else {
            // User has a profile but no company. Send them to the appropriate setup page.
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

      return () => unsubscribeUser();
    });

    return () => unsubscribeAuth();
  }, [navigate]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  const renderContent = () => {
    if (loading)
      return (
        <div className="text-center p-10">
          <p className="text-lg">Loading Dashboard...</p>
        </div>
      );
    if (error)
      return (
        <div className="text-center p-10 bg-red-100">
          <p className="text-red-700">{error}</p>
        </div>
      );

    if (userData && companyData) {
      if (userData.role === "head manager") {
        return <ManagerDashboard user={userData} company={companyData} />;
      }
      if (userData.role === "worker") {
        return <WorkerDashboard user={userData} company={companyData} />;
      }
    }

    return (
      <div className="text-center p-10">
        <p className="text-lg">Initializing...</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen">
      <header className="bg-white shadow-sm">
        <nav className="container mx-auto px-6 py-3 flex justify-between items-center">
          <h1 className="text-xl font-bold text-blue-600">
            {companyData ? companyData.name : "Scheduler"}
          </h1>
          {userData && (
            <button
              onClick={handleLogout}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-200 hover:bg-gray-300 focus:outline-none"
              title="Log Out"
            >
              {/* Log out icon (SVG) */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h4a2 2 0 012 2v1"
                />
              </svg>
            </button>
          )}
        </nav>
      </header>

      <main className="container mx-auto p-6">{renderContent()}</main>
    </div>
  );
};

export default Dashboard;
