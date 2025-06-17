// src/components/ManagerDashboard.jsx

import React, { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import ScheduleView from "./ScheduleView";
import AddWorkerModal from "./AddWorkerModal";
import EditPresetsModal from "./EditPresetsModal"; // Import the new modal

const ManagerDashboard = ({ user, company }) => {
  const [workers, setWorkers] = useState([]);
  const [loadingWorkers, setLoadingWorkers] = useState(true);
  const [isAddWorkerModalOpen, setIsAddWorkerModalOpen] = useState(false);
  const [isPresetsModalOpen, setIsPresetsModalOpen] = useState(false); // State for new modal
  const [presets, setPresets] = useState([]); // State to hold presets

  useEffect(() => {
    if (!company?.id) return;

    // Listener for the workers list
    const workersQuery = query(
      collection(db, "users"),
      where("companyId", "==", company.id)
    );
    const unsubscribeWorkers = onSnapshot(
      workersQuery,
      (snapshot) => {
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

    // Listener for shift presets
    const presetsDocRef = doc(db, "shiftPresets", company.id);
    const unsubscribePresets = onSnapshot(presetsDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setPresets(docSnap.data().presets || []);
      } else {
        setPresets([]);
      }
    });

    return () => {
      unsubscribeWorkers();
      unsubscribePresets();
    };
  }, [company]);

  return (
    <div>
      <AddWorkerModal
        isOpen={isAddWorkerModalOpen}
        onClose={() => setIsAddWorkerModalOpen(false)}
        companyId={company.id}
      />
      <EditPresetsModal
        isOpen={isPresetsModalOpen}
        onClose={() => setIsPresetsModalOpen(false)}
        companyId={company.id}
      />

      <div className="flex justify-between items-start mb-6">
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
          <div className="flex gap-2">
            <button
              onClick={() => setIsPresetsModalOpen(true)}
              className="flex-1 text-nowrap bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg"
            >
              Edit Presets
            </button>
            <button
              onClick={() => setIsAddWorkerModalOpen(true)}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition duration-200"
            >
              + Add Worker
            </button>
          </div>
        </div>
      </div>

      {loadingWorkers ? (
        <div className="text-center p-6 bg-white rounded-lg shadow">
          <p className="text-gray-500">Loading workers...</p>
        </div>
      ) : (
        <ScheduleView company={company} workers={workers} presets={presets} />
      )}
    </div>
  );
};

export default ManagerDashboard;
