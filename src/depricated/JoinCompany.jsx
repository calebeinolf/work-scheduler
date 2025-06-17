// src/components/JoinCompany.jsx

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "../firebase"; // Make sure this path is correct

const JoinCompany = () => {
  const [joinCode, setJoinCode] = useState("");
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        navigate("/login");
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      setError("You must be logged in to join a company.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const companiesRef = collection(db, "companies");
      const q = query(
        companiesRef,
        where("joinCode", "==", joinCode.toUpperCase().trim())
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError("Invalid join code. Please check the code and try again.");
        setLoading(false);
        return;
      }

      const companyDoc = querySnapshot.docs[0];
      const companyId = companyDoc.id;

      // Navigate to the claim profile page, passing the companyId in the state
      navigate("/claim-profile", { state: { companyId: companyId } });
    } catch (err) {
      setError("Failed to join the company. Please try again.");
      console.error("Error joining company:", err);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8">
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">
          Join a Company
        </h2>
        <p className="text-center text-gray-500 text-sm mb-6">
          Enter the join code provided by your manager.
        </p>

        {error && (
          <p className="bg-red-100 text-red-700 p-3 rounded-md mb-4 text-center">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              htmlFor="joinCode"
              className="block text-gray-700 text-sm font-bold mb-2"
            >
              Join Code
            </label>
            <input
              type="text"
              id="joinCode"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              required
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 uppercase tracking-widest text-center leading-tight focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="A4B9K2"
            />
          </div>
          <div className="flex items-center justify-between">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-green-300"
            >
              {loading ? "Joining..." : "Join Company"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default JoinCompany;
