// src/components/ManagerDashboard.jsx

import React, { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, doc } from "firebase/firestore";
import { db } from "../firebase";
import ScheduleView from "./ScheduleView";
import AddWorkerModal from "./AddWorkerModal";
import EditPresetsModal from "./EditPresetsModal";
import OffRequestsPage from "./OffRequestsPage";
import Loader from "../assets/Loader";

const ManagerDashboard = ({ user, company }) => {
  const [workers, setWorkers] = useState([]);
  const [loadingWorkers, setLoadingWorkers] = useState(true);
  const [isAddWorkerModalOpen, setIsAddWorkerModalOpen] = useState(false);
  const [isPresetsModalOpen, setIsPresetsModalOpen] = useState(false);
  const [showManageOffRequests, setShowManageOffRequests] = useState(false);
  const [presets, setPresets] = useState([]);

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

  // Show the OffRequestsPage if requested
  if (showManageOffRequests) {
    return (
      <OffRequestsPage
        company={company}
        onBack={() => setShowManageOffRequests(false)}
        isManager={true}
      />
    );
  }

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

      <div className="max-w-6xl mx-auto flex justify-between items-start mb-6 gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">
            Manager Dashboard
          </h2>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowManageOffRequests(true)}
            className="flex-1 text-nowrap bg-gray-500 hover:bg-gray-600 text-white font-medium py-1 px-3 rounded-md text-sm"
          >
            Manage OFF Requests
          </button>
          <button
            onClick={() => setIsPresetsModalOpen(true)}
            className="flex-1 text-nowrap bg-gray-500 hover:bg-gray-600 text-white font-medium py-1 px-3 rounded-md text-sm"
          >
            Edit Presets
          </button>
          <button
            onClick={() => setIsAddWorkerModalOpen(true)}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium text-nowrap py-1 px-3 rounded-md text-sm focus:outline-none focus:shadow-outline transition duration-200"
          >
            + Add Worker
          </button>
        </div>
      </div>

      {loadingWorkers ? (
        <div className="p-6 text-center flex items center justify-center gap-2">
          <Loader />
          <p className="text-gray-500">Loading schedule...</p>
        </div>
      ) : (
        <ScheduleView
          company={company}
          workers={workers}
          presets={presets}
          isManager={true}
          currentUserId={user.id}
          currentUserRole={user.role}
        />
      )}
    </div>
  );
};

export default ManagerDashboard;
