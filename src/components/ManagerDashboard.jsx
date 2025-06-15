// src/components/ManagerDashboard.jsx

import React, { useState, useEffect } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import ScheduleView from "./ScheduleView";
import AddWorkerModal from "./AddWorkerModal"; // Import the new modal

const ManagerDashboard = ({ user, company }) => {
  const [workers, setWorkers] = useState([]);
  const [loadingWorkers, setLoadingWorkers] = useState(true);
  const [isAddWorkerModalOpen, setIsAddWorkerModalOpen] = useState(false);

  useEffect(() => {
    if (!company?.id) return;

    // Listener for the workers list
    const workersQuery = query(
      collection(db, "users"),
      where("companyId", "==", company.id)
    );

    const unsubscribe = onSnapshot(
      workersQuery,
      (snapshot) => {
        // Include the manager in the workers list for display purposes if needed, or filter them out
        const workersList = snapshot.docs.map((doc) => ({
          ...doc.data(),
          uid: doc.id,
        }));
        setWorkers(workersList);
        setLoadingWorkers(false);
      },
      (error) => {
        console.error("Error fetching workers:", error);
        setLoadingWorkers(false);
      }
    );

    return () => unsubscribe();
  }, [company]);

  return (
    <div>
      {/* Render the modal for adding workers */}
      <AddWorkerModal
        isOpen={isAddWorkerModalOpen}
        onClose={() => setIsAddWorkerModalOpen(false)}
        companyId={company.id}
      />

      <div className="flex justify-between items-start mb-6">
        {/* Left side title */}
        <div>
          <h2 className="text-3xl font-bold text-gray-800">
            Manager Dashboard
          </h2>
          <p className="mt-1 text-gray-600">
            Welcome, {user.fullName || user.email}!
          </p>
        </div>

        {/* Right side with company code and Add Worker button */}
        <div className="text-right flex gap-2">
          <div className="p-2 rounded-lg flex items-center no-wrap gap-2 bg-white">
            <span className="text-sm text-nowrap font-semibold text-gray-600">
              Company Code:{" "}
            </span>
            <span className="text-sm text-nowrap font-bold text-blue-600 tracking-wider">
              {company.joinCode}
            </span>
          </div>
          <button
            onClick={() => setIsAddWorkerModalOpen(true)}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition duration-200"
          >
            + Add Worker
          </button>
        </div>
      </div>

      {loadingWorkers ? (
        <div className="text-center p-6 bg-white rounded-lg shadow">
          <p className="text-gray-500">Loading workers...</p>
        </div>
      ) : (
        // ScheduleView remains the same, displaying the fetched workers
        <ScheduleView company={company} workers={workers} />
      )}
    </div>
  );
};

export default ManagerDashboard;
