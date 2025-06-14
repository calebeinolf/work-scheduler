// src/components/WorkerDashboard.jsx

import React from "react";

const WorkerDashboard = ({ user, company }) => {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-800">Worker Dashboard</h2>
        <p className="mt-1 text-gray-600">
          Welcome, {user.fullName || user.email}!
        </p>
      </div>

      <div className="mt-6 p-6 bg-white rounded-lg shadow">
        <h3 className="text-xl font-semibold">
          Your Schedule for {company.name}
        </h3>
        <p className="mt-2 text-gray-500">
          Your weekly schedule view will appear here soon.
        </p>
        {/* The worker's version of the schedule view will be added here later */}
      </div>
    </div>
  );
};

export default WorkerDashboard;
