// src/components/RoleSelection.jsx

import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

const RoleSelection = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        navigate("/login");
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [navigate]);

  const handleRoleSelect = async (role) => {
    if (!user) {
      setError("No user is signed in. Please log in again.");
      return;
    }

    const signUpData = location.state || {};
    const { firstName = "", lastName = "" } = signUpData;

    try {
      if (role === "head manager") {
        // Create the manager's user document in Firestore, using their UID as the doc ID
        const userDocRef = doc(db, "users", user.uid);
        await setDoc(userDocRef, {
          role: "head manager",
          authUid: user.uid,
          email: user.email,
          fullName: `${firstName} ${lastName}`.trim(),
          companyId: null,
          title: "Head Manager",
          // These fields are not applicable to managers upon signup
          isMinor: false,
          yos: 0,
          phone: "",
          dob: "",
        });
        navigate("/create-company");
      } else {
        // For workers, we do NOT create a user document here.
        // They will claim a pre-made profile later.
        // We just navigate them to the next step.
        navigate("/join-company");
      }
    } catch (err) {
      setError("Failed to save your role. Please try again.");
      console.error("Error setting user role:", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-lg bg-white rounded-lg shadow-md p-8 text-center">
        <h2 className="text-3xl font-bold text-gray-800 mb-4">Who are you?</h2>
        <p className="text-gray-600 mb-8">Choose your role to get started.</p>

        {error && (
          <p className="bg-red-100 text-red-700 p-3 rounded-md mb-4">{error}</p>
        )}

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => handleRoleSelect("head manager")}
            className="flex-1 bg-blue-500 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg"
          >
            I'm a Manager
          </button>
          <button
            onClick={() => handleRoleSelect("worker")}
            className="flex-1 bg-green-500 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg"
          >
            I'm a Worker
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoleSelection;
