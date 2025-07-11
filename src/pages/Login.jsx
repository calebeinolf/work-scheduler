// src/pages/Login.jsx

import React, { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { auth, db } from "../firebase";
import Loader from "../assets/Loader";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const navigate = useNavigate();
  const location = useLocation();

  // Check if we received a message from the Dashboard (account unlinked scenario)
  useEffect(() => {
    if (location.state?.message) {
      if (location.state.type === "info") {
        setInfo(location.state.message);
      } else {
        setError(location.state.message);
      }
      // Clear the state so the message doesn't persist on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      // CORRECTED LOGIC: Query the 'users' collection to find a document
      // where the authUid field matches the logged-in user's UID.
      const q = query(
        collection(db, "users"),
        where("authUid", "==", user.uid),
        limit(1)
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        // A profile exists for this user (they are a manager or have claimed a profile).
        // Send them to the dashboard.
        navigate("/schedule");
      } else {
        // No profile found. This auth account hasn't been linked.
        // This could happen if:
        // 1. They just signed up and haven't selected a role yet
        // 2. A manager changed their email, unlinking their account

        // Sign them out and show a specific error message
        await signOut(auth);
        setError(
          "This account is not linked to any profile. If a manager recently changed your email, please contact them for your new login credentials."
        );
      }
    } catch (err) {
      console.error("Failed to log in:", err);

      // Provide specific error messages based on Firebase error codes
      switch (err.code) {
        case "auth/user-not-found":
          setError("No account found with this email address.");
          break;
        case "auth/wrong-password":
          setError("Incorrect password.");
          break;
        case "auth/invalid-email":
          setError("Invalid email address.");
          break;
        case "auth/user-disabled":
          setError("This account has been disabled.");
          break;
        case "auth/too-many-requests":
          setError("Too many failed attempts. Please try again later.");
          break;
        default:
          setError("Failed to log in. Please check your credentials.");
      }
    }
  };

  const [loading, setLoading] = useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8">
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">
          Log In
        </h2>

        {info && (
          <p className="bg-blue-100 text-blue-700 p-3 rounded-md mb-4 text-center">
            {info}
          </p>
        )}

        {error && (
          <p className="bg-red-100 text-red-700 p-3 rounded-md mb-4 text-center">
            {error}
          </p>
        )}

        <form
          onSubmit={async (e) => {
            setLoading(true);
            await handleSubmit(e);
            setLoading(false);
          }}
        >
          <div className="mb-4">
            <label
              htmlFor="email"
              className="block text-gray-700 text-sm font-bold mb-2"
            >
              Email Address
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="you@example.com"
              disabled={loading}
            />
          </div>
          <div className="mb-6">
            <label
              htmlFor="password"
              className="block text-gray-700 text-sm font-bold mb-2"
            >
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
              disabled={loading}
            />
          </div>
          <div className="flex items-center justify-between">
            <button
              type="submit"
              className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline flex items-center justify-center"
              disabled={loading}
            >
              {loading ? <Loader color={"white"} /> : null}
              {loading ? "Logging In..." : "Log In"}
            </button>
          </div>
        </form>

        <p className="text-center text-gray-500 text-sm mt-6">
          Don't have an account?{" "}
          <Link
            to="/signup"
            className="font-bold text-blue-500 hover:text-blue-700"
          >
            Sign Up
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
