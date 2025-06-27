// src/components/AddWorkerModal.jsx

import React, { useState } from "react";
import { collection, addDoc } from "firebase/firestore";
import { db } from "../firebase";

const AddWorkerModal = ({ isOpen, onClose, companyId }) => {
  const [fullName, setFullName] = useState("");
  const [yos, setYos] = useState("");
  const [email, setEmail] = useState(""); // Email is required for matching
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState("Lifeguard");
  const [isMinor, setIsMinor] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Create the unclaimed worker profile in Firestore
      await addDoc(collection(db, "users"), {
        companyId: companyId,
        role: "worker",
        authUid: null, // Unclaimed until worker joins
        email: email, // The key field for matching
        fullName: fullName,
        yos: parseInt(yos, 10),
        isMinor: isMinor,
        title: title,
        phone: phone, // Optional phone field
      });
      handleClose();
    } catch (err) {
      setError("Failed to add worker. Please try again.");
      console.error("Error adding worker:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFullName("");
    setYos("");
    setEmail("");
    setTitle("Lifeguard");
    setIsMinor(false);
    setError("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          <div className="p-6">
            <h3 className="text-2xl font-bold text-gray-800 mb-4">
              Add New Worker
            </h3>
            {error && (
              <p className="bg-red-100 text-red-700 p-3 rounded-md mb-4 text-center">
                {error}
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="fullName"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Full Name
                </label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  placeholder="John Smith"
                  className="p-2 border rounded w-full"
                />
              </div>
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Worker's Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="example@gmail.com"
                  className="p-2 border rounded w-full"
                />
              </div>
              <div>
                <label
                  htmlFor="phone"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Worker's Phone (optional)
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="123-456-7890"
                  className="p-2 border rounded w-full"
                />
              </div>
              <div>
                <label
                  htmlFor="role"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Role
                </label>
                <select
                  id="role"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="p-2 border bg-white rounded w-full"
                >
                  <option>Lifeguard</option>
                  <option>Front Worker</option>
                  <option>Head Guard</option>
                  <option>Assistant Manager</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="yos"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Years of Service
                </label>
                <input
                  id="yos"
                  type="number"
                  value={yos}
                  onChange={(e) => setYos(e.target.value)}
                  required
                  placeholder="0"
                  className="p-2 border rounded w-full"
                  min="0"
                />
              </div>
              <div className="flex items-center mt-2">
                <input
                  id="isMinor"
                  type="checkbox"
                  checked={isMinor}
                  onChange={(e) => setIsMinor(e.target.checked)}
                  className="mr-2"
                />
                <label
                  htmlFor="isMinor"
                  className="text-sm font-medium text-gray-700"
                >
                  Is Minor
                </label>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 p-3 flex justify-end space-x-3 rounded-b-lg">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300"
            >
              {loading ? "Saving..." : "Save Worker"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddWorkerModal;
