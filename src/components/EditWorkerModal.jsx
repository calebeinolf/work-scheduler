// src/components/EditWorkerModal.jsx

import React, { useState, useEffect } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

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

const EditWorkerModal = ({ worker, isOpen, onClose }) => {
  const [formData, setFormData] = useState({
    fullName: "",
    yos: "",
    dob: "",
    email: "",
    phone: "",
    title: "Lifeguard",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Populate form when a worker is selected
  useEffect(() => {
    if (worker) {
      setFormData({
        fullName: worker.fullName || "",
        yos: worker.yos || "",
        dob: worker.dob || "",
        email: worker.email || "",
        phone: worker.phone || "",
        title: worker.title || "Lifeguard",
      });
    }
  }, [worker]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const workerDocRef = doc(db, "users", worker.uid);
      const updates = {
        ...formData,
        yos: parseInt(formData.yos, 10),
        isMinor: isMinorCheck(formData.dob),
      };

      // If the email is changed on a claimed profile, unlink it.
      if (worker.authUid && worker.email !== formData.email) {
        updates.authUid = null;
      }

      await updateDoc(workerDocRef, updates);
      onClose();
    } catch (err) {
      setError("Failed to update worker. Please try again.");
      console.error("Error updating worker:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const showEmailWarning = worker.authUid && worker.email !== formData.email;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          <div className="p-6">
            <h3 className="text-2xl font-bold text-gray-800 mb-4">
              Edit Worker
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
                  name="fullName"
                  type="text"
                  value={formData.fullName}
                  onChange={handleChange}
                  required
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
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="p-2 border rounded w-full"
                />
              </div>
              {showEmailWarning && (
                <p className="text-xs text-orange-600 col-span-2 text-center -mt-2">
                  Warning: Changing the email will unlink this worker's account.
                  They will need to re-join with the new email.
                </p>
              )}
              <div>
                <label
                  htmlFor="phone"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Phone (optional)
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  className="p-2 border rounded w-full"
                />
              </div>
              <div>
                <label
                  htmlFor="title"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Role
                </label>
                <select
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  className="p-2 border bg-white rounded w-full"
                >
                  <option>Lifeguard</option>
                  <option>Head Guard</option>
                  <option>Assistant Manager</option>
                  <option>Front Worker</option>
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
                  name="yos"
                  type="number"
                  value={formData.yos}
                  onChange={handleChange}
                  required
                  className="p-2 border rounded w-full"
                  min="0"
                />
              </div>
              <div>
                <label
                  htmlFor="dob"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Date of Birth
                </label>
                <input
                  type="date"
                  id="dob"
                  name="dob"
                  value={formData.dob}
                  onChange={handleChange}
                  required
                  className="w-full p-2 border rounded"
                />
              </div>
            </div>
          </div>
          <div className="bg-gray-50 p-3 flex justify-end space-x-3 rounded-b-lg">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300"
            >
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditWorkerModal;
