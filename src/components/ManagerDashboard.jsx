// src/components/ManagerDashboard.jsx

import React, { useState, useEffect } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import ScheduleView from "./ScheduleView";

const ManagerDashboard = ({ user, company }) => {
  const [workers, setWorkers] = useState([]);
  const [loadingWorkers, setLoadingWorkers] = useState(true);

  useEffect(() => {
    // Ensure company.id is available before querying
    if (!company?.id) return;

    // Set up a real-time listener for the workers list
    const workersQuery = query(
      collection(db, "users"),
      where("companyId", "==", company.id)
    );

    const unsubscribe = onSnapshot(
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

    // Cleanup listener on component unmount
    return () => unsubscribe();
  }, [company]);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-800">Manager Dashboard</h2>
        <p className="mt-1 text-gray-600">
          Welcome, {user.fullName || user.email}! You are managing{" "}
          <strong>{company.name}</strong>.
        </p>
      </div>
      {loadingWorkers ? (
        <div className="text-center p-6 bg-white rounded-lg shadow">
          <p className="text-gray-500">Loading workers...</p>
        </div>
      ) : (
        <ScheduleView company={company} workers={workers} />
      )}
    </div>
  );
};

export default ManagerDashboard;
