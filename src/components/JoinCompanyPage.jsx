// src/components/JoinCompanyPage.jsx

import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  limit,
} from "firebase/firestore";
import { auth, db } from "../firebase";

const JoinCompanyPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyCode, setCompanyCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // 1. Find the company by its join code
      const companyQuery = query(
        collection(db, "companies"),
        where("joinCode", "==", companyCode.toUpperCase().trim()),
        limit(1)
      );
      const companySnapshot = await getDocs(companyQuery);

      if (companySnapshot.empty) {
        throw new Error("Invalid company code.");
      }
      const companyDoc = companySnapshot.docs[0];
      const companyId = companyDoc.id;

      // 2. Find an unclaimed worker profile with the provided email in that company
      const workerQuery = query(
        collection(db, "users"),
        where("companyId", "==", companyId),
        where("email", "==", email),
        where("authUid", "==", null),
        limit(1)
      );
      const workerSnapshot = await getDocs(workerQuery);

      if (workerSnapshot.empty) {
        throw new Error(
          "The manager hasn't added you yet. Check you used the right email."
        );
      }
      const workerDoc = workerSnapshot.docs[0];

      // 3. Create the auth account for the worker
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      // 4. Link the auth account to the worker profile
      await updateDoc(doc(db, "users", workerDoc.id), {
        authUid: user.uid,
      });

      // 5. Sign in the new user to create a session and navigate to dashboard
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/schedule");
    } catch (err) {
      setError(err.message);
      console.error("Error joining company:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-lg bg-white rounded-lg shadow-md p-8">
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">
          Join a Company
        </h2>
        {error && (
          <p className="bg-red-100 text-red-700 p-3 rounded-md mb-4 text-center">
            {error}
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={companyCode}
            onChange={(e) => setCompanyCode(e.target.value)}
            required
            placeholder="Company Code"
            className="w-full p-2 border rounded"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="Your Email Address"
            className="w-full p-2 border rounded"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Create a Password"
            className="w-full p-2 border rounded"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:bg-green-300"
          >
            {loading ? "Joining..." : "Join & Continue"}
          </button>
        </form>
        <p className="text-center text-sm mt-4">
          Are you a manager?{" "}
          <Link to="/create-company" className="font-semibold text-green-600">
            Create a company here
          </Link>
        </p>
      </div>
    </div>
  );
};

export default JoinCompanyPage;
