// src/components/WorkerDashboard.jsx

import React, { useState, useEffect } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase"; // Corrected import path
import ScheduleView from "./ScheduleView";

const WorkerDashboard = ({ user, company }) => {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-800">Worker Dashboard</h2>
        <p className="mt-1 text-gray-600">
          Welcome, {user.fullName || user.email}!
        </p>
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="p-6 text-center">
            <p className="text-gray-500">Loading schedule...</p>
          </div>
        ) : (
          <ScheduleView
            company={company}
            workers={workers}
            presets={[]} // Presets are not needed for worker view
            isManager={false} // This ensures the view is read-only
          />
        )}
      </div>
    </div>
  );
};

export default WorkerDashboard;
