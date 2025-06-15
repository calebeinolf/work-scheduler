// src/components/CreateCompanyPage.jsx

import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, addDoc, collection } from "firebase/firestore";
import { auth, db } from "../firebase";

const CreateCompanyPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [yos, setYos] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const generateJoinCode = (length = 6) => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // 1. Create the auth user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      // 2. Create the company document
      const joinCode = generateJoinCode();
      const companyDocRef = await addDoc(collection(db, "companies"), {
        name: companyName,
        ownerId: user.uid,
        joinCode: joinCode,
      });

      // 3. Create the manager's user document
      await setDoc(doc(db, "users", user.uid), {
        role: "head manager",
        authUid: user.uid,
        companyId: companyDocRef.id,
        email: user.email,
        fullName: fullName,
        title: "Head Manager",
        yos: parseInt(yos, 10),
      });

      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
      console.error("Error creating company:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-lg bg-white rounded-lg shadow-md p-8">
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">
          Create a Company
        </h2>
        {error && (
          <p className="bg-red-100 text-red-700 p-3 rounded-md mb-4 text-center">
            {error}
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            required
            placeholder="Company Name"
            className="w-full p-2 border rounded"
          />
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            placeholder="Your Full Name"
            className="w-full p-2 border rounded"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="Your Email"
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
          <input
            type="number"
            value={yos}
            onChange={(e) => setYos(e.target.value)}
            required
            placeholder="Your Years of Service"
            className="w-full p-2 border rounded"
            min="0"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:bg-blue-300"
          >
            {loading ? "Creating..." : "Create & Continue"}
          </button>
        </form>
        <p className="text-center text-sm mt-4">
          Already have a company?{" "}
          <Link to="/join-company" className="font-semibold text-blue-600">
            Join here
          </Link>
        </p>
      </div>
    </div>
  );
};

export default CreateCompanyPage;
