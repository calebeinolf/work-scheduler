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

const ScheduleView = ({ company, workers }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [scheduleData, setScheduleData] = useState({});
  const [loading, setLoading] = useState(true);

  // Memoize the start date of the current week to prevent unnecessary recalculations
  const weekStartDate = useMemo(
    () => getSaturdayOfWeek(currentDate),
    [currentDate]
  );

  // --- Worker Sorting Logic ---
  const sortedWorkers = useMemo(() => {
    const titleOrder = {
      "head manager": 1,
      "assistant manager": 2,
      "head guard": 3,
      lifeguard: 4,
      "front worker": 5,
    };

    return [...workers].sort((a, b) => {
      const titleA = a.title || "";
      const titleB = b.title || "";

      // If one user is the manager, they come first
      if (a.role === "head manager" && b.role !== "head manager") return -1;
      if (b.role === "head manager" && a.role !== "head manager") return 1;

      // Sort by title order
      const orderA = titleOrder[titleA] || 99;
      const orderB = titleOrder[titleB] || 99;
      if (orderA !== orderB) {
        return orderA - orderB;
      }

      // If titles are the same, sort by start year (descending for YOS)
      return (b.startYear || 0) - (a.startYear || 0);
    });
  }, [workers]);

  // --- Data Fetching Effect ---
  useEffect(() => {
    if (!company?.id) return;
    setLoading(true);

    // Format date as YYYY-MM-DD for a consistent document ID
    const weekId = weekStartDate.toISOString().split("T")[0];
    const scheduleDocId = `${company.id}_${weekId}`;
    const scheduleDocRef = doc(db, "schedules", scheduleDocId);

    const unsubscribe = onSnapshot(scheduleDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setScheduleData(docSnap.data().shifts || {});
      } else {
        // If no schedule exists for this week, create one
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

    return () => unsubscribe(); // Cleanup listener on component unmount
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
      {/* Header with Navigation */}
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

      {/* Schedule Grid */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 border text-left text-sm font-semibold text-gray-600">
                Worker
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
                <td colSpan="9" className="text-center p-4">
                  Loading schedule...
                </td>
              </tr>
            ) : (
              sortedWorkers.map((worker) => (
                <tr key={worker.uid} className="even:bg-gray-50">
                  <td className="p-2 border font-medium">
                    {worker.fullName || worker.email}
                    {worker.isMinor && (
                      <span className="text-red-500 font-bold ml-1">(M)</span>
                    )}
                    <div className="text-xs text-gray-500">{worker.title}</div>
                  </td>
                  {["sat", "sun", "mon", "tue", "wed", "thu", "fri"].map(
                    (day) => {
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
                    }
                  )}
                  <td className="p-2 border text-center font-bold">
                    {/* Hour calculation will go here */}0
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ScheduleView;
