// src/components/ScheduleView.jsx

import React, { useState, useEffect, useMemo } from "react";
import { onSnapshot, doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";

// Helper to get the start of a week (Saturday) for any given date
const getSaturdayOfWeek = (d) => {
  const date = new Date(d);
  const day = date.getDay(); // Sunday - Saturday : 0 - 6
  const diff = date.getDate() - day - 1; // Adjust to Saturday
  return new Date(date.setDate(diff));
};

// --- New Worker Details Modal Component ---
const WorkerDetailModal = ({ worker, onClose }) => {
  if (!worker) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <h3 className="text-2xl font-bold text-gray-800">
            {worker.fullName}
          </h3>
          <p className="text-gray-500">{worker.isMinor ? "Minor" : "Adult"}</p>

          <div className="mt-6 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="font-semibold text-gray-600">Position:</span>
              <span className="text-gray-800">{worker.title}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-gray-600">Phone:</span>
              <span className="text-gray-800">
                {worker.phone || "Not provided"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-gray-600">
                Years of Service:
              </span>
              <span className="text-gray-800">{worker.yos ?? "N/A"}</span>
            </div>
          </div>
        </div>
        <div className="bg-gray-50 p-4 rounded-b-lg text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Reusable Worker Row Component for cleaner code ---
const WorkerRow = ({ worker, scheduleData, onWorkerClick }) => (
  <tr key={worker.uid} className="even:bg-gray-50">
    <td
      className="p-2 border font-medium hover:bg-blue-50 cursor-pointer"
      onClick={() => onWorkerClick(worker)}
    >
      {worker.fullName || worker.email}
      {worker.isMinor && (
        <span className="text-gray-500 font-medium ml-1">(M)</span>
      )}
      {worker.title && worker.title !== "Lifeguard" && (
        <div className="text-xs text-gray-500">{worker.title}</div>
      )}
    </td>
    <td className="p-2 border text-center">{worker.yos ?? 0}</td>
    {["sat", "sun", "mon", "tue", "wed", "thu", "fri"].map((day) => {
      const shift = scheduleData[worker.uid]?.[day];
      return (
        <td
          key={day}
          className="p-2 border text-center h-16 hover:bg-blue-50 cursor-pointer"
        >
          {shift ? (
            `${shift.start}-${shift.end} ${shift.type}`
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </td>
      );
    })}
    <td className="p-2 border text-center font-bold">0</td>
  </tr>
);

const ScheduleView = ({ company, workers }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [scheduleData, setScheduleData] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedWorker, setSelectedWorker] = useState(null); // State for the modal

  const weekStartDate = useMemo(
    () => getSaturdayOfWeek(currentDate),
    [currentDate]
  );

  // --- Worker Sorting and Grouping Logic ---
  const { sortedManagersAndGuards, sortedFrontWorkers } = useMemo(() => {
    const titleOrder = {
      "head manager": 1,
      "assistant manager": 2,
      "head guard": 3,
      lifeguard: 4,
      "front worker": 5,
    };

    const sortLogic = (a, b) => {
      const titleA = a.title || "";
      const titleB = b.title || "";

      if (a.role === "head manager" && b.role !== "head manager") return -1;
      if (b.role === "head manager" && a.role !== "head manager") return 1;

      const orderA = titleOrder[titleA.toLowerCase()] || 99;
      const orderB = titleOrder[titleB.toLowerCase()] || 99;
      if (orderA !== orderB) {
        return orderA - orderB;
      }

      // Sort by yos descending (most years first)
      return (b.yos || 0) - (a.yos || 0);
    };

    const managersAndGuards = workers.filter((w) => w.title !== "Front Worker");
    const frontWorkers = workers.filter((w) => w.title === "Front Worker");

    return {
      sortedManagersAndGuards: managersAndGuards.sort(sortLogic),
      sortedFrontWorkers: frontWorkers.sort(sortLogic),
    };
  }, [workers]);

  // --- Data Fetching Effect ---
  useEffect(() => {
    if (!company?.id) return;
    setLoading(true);

    const weekId = weekStartDate.toISOString().split("T")[0];
    const scheduleDocId = `${company.id}_${weekId}`;
    const scheduleDocRef = doc(db, "schedules", scheduleDocId);

    const unsubscribe = onSnapshot(scheduleDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setScheduleData(docSnap.data().shifts || {});
      } else {
        const initialShifts = {};
        workers.forEach((w) => {
          initialShifts[w.uid] = {
            sat: null,
            sun: null,
            mon: null,
            tue: null,
            wed: null,
            thu: null,
            fri: null,
          };
        });

        setDoc(scheduleDocRef, {
          companyId: company.id,
          weekOf: weekStartDate,
          isPublished: false,
          shifts: initialShifts,
        });
        setScheduleData(initialShifts);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [weekStartDate, company, workers]);

  const handleWeekChange = (weeks) => {
    setCurrentDate((prevDate) => {
      const newDate = new Date(prevDate);
      newDate.setDate(newDate.getDate() + weeks * 7);
      return newDate;
    });
  };

  // --- Render Helpers ---
  const renderWeekHeader = () => {
    const days = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];
    const headerDates = [];
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(weekStartDate);
      dayDate.setDate(dayDate.getDate() + i);
      headerDates.push(
        `${days[i]} ${dayDate.getMonth() + 1}/${dayDate.getDate()}`
      );
    }
    return headerDates.map((day) => (
      <th
        key={day}
        className="p-2 border text-sm font-semibold text-gray-600 bg-gray-50"
      >
        {day}
      </th>
    ));
  };

  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekStartDate.getDate() + 6);

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <WorkerDetailModal
        worker={selectedWorker}
        onClose={() => setSelectedWorker(null)}
      />

      <div className="flex justify-between items-center mb-4">
        <button
          onClick={() => handleWeekChange(-1)}
          className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
        >
          &larr; Previous
        </button>
        <h3 className="text-xl font-bold text-center">
          Week of {weekStartDate.toLocaleDateString()} -{" "}
          {weekEndDate.toLocaleDateString()}
        </h3>
        <button
          onClick={() => handleWeekChange(1)}
          className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
        >
          Next &rarr;
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse border">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 border text-left text-sm font-semibold text-gray-600 min-w-[160px]">
                Guards & Managers
              </th>
              <th className="p-2 border text-sm font-semibold text-gray-600 bg-gray-50">
                YOS
              </th>
              {renderWeekHeader()}
              <th className="p-2 border text-sm font-semibold text-gray-600 bg-gray-50">
                Total Hours
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="10" className="text-center p-4">
                  Loading schedule...
                </td>
              </tr>
            ) : (
              sortedManagersAndGuards.map((worker) => (
                <WorkerRow
                  key={worker.uid}
                  worker={worker}
                  scheduleData={scheduleData}
                  onWorkerClick={setSelectedWorker}
                />
              ))
            )}
          </tbody>
        </table>

        {sortedFrontWorkers.length > 0 && (
          <table className="w-full border-collapse border mt-6">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 border text-left text-sm font-semibold text-gray-600 min-w-[160px]">
                  Front Workers
                </th>
                <th className="p-2 border text-sm font-semibold text-gray-600 bg-gray-50">
                  YOS
                </th>
                {renderWeekHeader()}
                <th className="p-2 border text-sm font-semibold text-gray-600 bg-gray-50">
                  Total Hours
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedFrontWorkers.map((worker) => (
                <WorkerRow
                  key={worker.uid}
                  worker={worker}
                  scheduleData={scheduleData}
                  onWorkerClick={setSelectedWorker}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ScheduleView;
