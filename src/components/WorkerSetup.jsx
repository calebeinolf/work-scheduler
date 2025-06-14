// src/components/WorkerSetup.jsx

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

const WorkerSetup = () => {
  const [position, setPosition] = useState("Lifeguard");
  const [startYear, setStartYear] = useState("");
  const [phone, setPhone] = useState(""); // New state for phone number
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
      setError("User not found. Please log in again.");
      return;
    }
    setLoading(true);

    try {
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        title: position,
        startYear: parseInt(startYear, 10),
        phone: phone, // Save the phone number
      });

      navigate("/dashboard");
    } catch (err) {
      setError("Failed to save your details. Please try again.");
      console.error("Error updating worker details:", err);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8">
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">
          Final Step!
        </h2>
        <p className="text-center text-gray-500 text-sm mb-6">
          Tell us a bit more about your role.
        </p>

        {error && (
          <p className="bg-red-100 text-red-700 p-3 rounded-md mb-4 text-center">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="position"
              className="block text-gray-700 text-sm font-bold mb-2"
            >
              Your Position
            </label>
            <select
              id="position"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Lifeguard">Lifeguard</option>
              <option value="Head Guard">Head Guard</option>
              <option value="Assistant Manager">Assistant Manager</option>
              <option value="Front Worker">Front Worker</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="phone"
              className="block text-gray-700 text-sm font-bold mb-2"
            >
              Phone Number
            </label>
            <input
              type="tel"
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="123-456-7890"
            />
          </div>

          <div>
            <label
              htmlFor="startYear"
              className="block text-gray-700 text-sm font-bold mb-2"
            >
              Start Year
            </label>
            <input
              type="number"
              id="startYear"
              value={startYear}
              onChange={(e) => setStartYear(e.target.value)}
              required
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={new Date().getFullYear().toString()}
              min="1980"
              max={new Date().getFullYear()}
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-blue-300"
            >
              {loading ? "Saving..." : "Complete Setup"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WorkerSetup;
