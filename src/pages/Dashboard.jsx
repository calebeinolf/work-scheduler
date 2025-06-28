// src/pages/Dashboard.jsx

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
} from "firebase/firestore";
import { auth, db } from "../firebase";
import ManagerDashboard from "../components/ManagerDashboard";
import WorkerDashboard from "../components/WorkerDashboard";
import { LogOut } from "lucide-react";
import Loader from "../assets/Loader";
import wdiwFavicon from "../assets/wdiw-favicon.svg";

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
    // Clear the hash to prevent it from being used on the login page or by the next user
    window.location.hash = "";
    navigate("/login");
  };

  const renderContent = () => {
    if (loading)
      return (
        <div className="flex items-center justify-center gap-2 text-center p-10">
          <Loader width={22} />
          <p className="text-lg text-gray-500">Loading Dashboard</p>
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
      <header className="bg-white shadow-sm px-6 py-2">
        <nav className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src={wdiwFavicon} alt="Company Logo" className="w-6 h-6" />
            <h1 className="text-lg font-semibold text-blue-600">
              {companyData ? companyData.name : ""}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {userData && (
              <div className=" rounded-lg flex items-center no-wrap gap-1">
                <span className="text-sm text-nowrap font-medium text-gray-600">
                  {userData.fullName || userData.email}
                </span>
                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center w-8 h-8 rounded-full bg-white hover:bg-gray-100 focus:outline-none"
                  title="Log Out"
                >
                  <LogOut width={15} />
                </button>
              </div>
            )}
          </div>
        </nav>
      </header>

      <main className="py-6 px-2 sm:px-4 md:px-6 lg:px-8 xl:px-10 max-w-7xl mx-auto">
        {renderContent()}
      </main>
    </div>
  );
};

export default Dashboard;
