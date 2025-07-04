// src/components/WorkerDashboard.jsx

import React, { useState, useEffect } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase"; // Corrected import path
import ScheduleView from "./ScheduleView";
import RequestOffModal from "./RequestOffModal";
import OffRequestsPage from "./OffRequestsPage";
import Loader from "../assets/Loader";

const WorkerDashboard = ({ user, company }) => {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRequestOffModalOpen, setIsRequestOffModalOpen] = useState(false);
  const [showMyOffRequests, setShowMyOffRequests] = useState(false);

  useEffect(() => {
    if (!company?.id) return;

    // Listener for the workers list. ScheduleView needs this to display names.
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
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching workers:", error);
        setLoading(false);
      }
    );

    return () => unsubscribeWorkers();
  }, [company]);

  // Show the OffRequestsPage if requested
  if (showMyOffRequests) {
    return (
      <OffRequestsPage
        user={user}
        company={company}
        onBack={() => setShowMyOffRequests(false)}
        isManager={false}
      />
    );
  }

  return (
    <div>
      <RequestOffModal
        isOpen={isRequestOffModalOpen}
        onClose={() => setIsRequestOffModalOpen(false)}
        user={user}
        company={company}
      />

      <div className="max-w-6xl mx-auto flex justify-between items-start mb-6 gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">
            Welcome, {user?.fullName && user.fullName.split(" ")[0]}!
          </h2>
        </div>

        <div className="text-right flex gap-2 flex-wrap justify-end">
          <div className="flex gap-2">
            <button
              onClick={() => setShowMyOffRequests(true)}
              className="bg-gray-500 hover:bg-gray-600 text-white font-medium text-nowrap py-1 px-3 rounded-md text-sm focus:outline-none focus:shadow-outline transition duration-200"
            >
              Manage OFF Requests
            </button>
            <button
              onClick={() => setIsRequestOffModalOpen(true)}
              className="w-full bg-red-500 hover:bg-red-600 text-white font-medium text-nowrap py-1 px-3 rounded-md text-sm focus:outline-none focus:shadow-outline transition duration-200"
            >
              Request OFF
            </button>
          </div>
        </div>
      </div>

      <div className="">
        {loading ? (
          <div className="p-6 text-center flex items center justify-center gap-2">
            <Loader />
            <p className="text-gray-500">Loading schedule...</p>
          </div>
        ) : (
          <ScheduleView
            company={company}
            workers={workers}
            presets={[]} // Presets are not needed for worker view
            isManager={false} // This ensures the view is read-only
            currentUserId={user.id}
            currentUserRole={user.role}
          />
        )}
      </div>
    </div>
  );
};

export default WorkerDashboard;
