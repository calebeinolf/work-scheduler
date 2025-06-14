// src/components/RoleSelection.jsx

import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase"; // Make sure this path is correct

/**
 * Calculates if a person is under 18 based on their date of birth.
 * @param {string} dobString - The date of birth string (e.g., "YYYY-MM-DD").
 * @returns {boolean} True if under 18, false otherwise.
 */
const isMinorCheck = (dobString) => {
  if (!dobString) return false;
  const today = new Date();
  const birthDate = new Date(dobString);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDifference = today.getMonth() - birthDate.getMonth();
  if (
    monthDifference < 0 ||
    (monthDifference === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }
  return age < 18;
};

const RoleSelection = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const location = useLocation(); // Hook to access navigation state

  // Effect to listen for auth state changes and get the current user
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

  /**
   * Handles the user's role choice, creates a user document in Firestore,
   * and navigates to the next appropriate page.
   * @param {string} role - The role selected by the user ('head manager' or 'worker').
   */
  const handleRoleSelect = async (role) => {
    if (!user) {
      setError("No user is signed in. Please log in again.");
      return;
    }

    // Get the sign-up data passed from the previous page
    const signUpData = location.state || {};
    const { firstName = "", lastName = "", dob = "" } = signUpData;

    try {
      const userDocRef = doc(db, "users", user.uid);

      // Construct the data object to save to Firestore
      const newUserDoc = {
        uid: user.uid,
        email: user.email,
        role: role,
        fullName: `${firstName} ${lastName}`.trim(),
        dob: dob,
        isMinor: isMinorCheck(dob),
        // The following fields will now be set in the WorkerSetup component
        phone: "",
        title: role === "worker" ? "" : "Head Manager",
        startYear: null,
      };

      await setDoc(userDocRef, newUserDoc);

      if (role === "head manager") {
        navigate("/create-company");
      } else {
        navigate("/join-company");
      }
    } catch (err) {
      setError("Failed to save your role. Please try again.");
      console.error("Error setting user role:", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-lg bg-white rounded-lg shadow-md p-8 text-center">
        <h2 className="text-3xl font-bold text-gray-800 mb-4">Who are you?</h2>
        <p className="text-gray-600 mb-8">
          Choose your role to get started. This helps us tailor your experience.
        </p>

        {error && (
          <p className="bg-red-100 text-red-700 p-3 rounded-md mb-4">{error}</p>
        )}

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => handleRoleSelect("head manager")}
            className="flex-1 bg-blue-500 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg focus:outline-none focus:shadow-outline transition duration-300"
          >
            I'm a Manager
          </button>
          <button
            onClick={() => handleRoleSelect("worker")}
            className="flex-1 bg-green-500 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg focus:outline-none focus:shadow-outline transition duration-300"
          >
            I'm a Worker
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoleSelection;
