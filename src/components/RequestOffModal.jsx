// src/components/RequestOffModal.jsx

import React, { useState } from "react";
import {
  addDoc,
  collection,
  doc,
  updateDoc,
  setDoc,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase";
import { Calendar, Clock } from "lucide-react";
import { getSundayOfWeek } from "../utils/scheduleUtils";

const RequestOffModal = ({ isOpen, onClose, user, company }) => {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isAllDay, setIsAllDay] = useState(true);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (!startDate) {
        setError("Please select a start date");
        return;
      }

      if (!user?.uid && !user?.id) {
        setError("User information is missing. Please try logging in again.");
        return;
      }

      if (!company?.id) {
        setError("Company information is missing. Please try again.");
        return;
      }

      // Create dates properly to avoid timezone issues
      const requestStartDate = new Date(startDate + "T00:00:00");
      const requestEndDate = endDate
        ? new Date(endDate + "T00:00:00")
        : requestStartDate;
      const currentDate = new Date();
      const twoWeeksFromNow = new Date();
      twoWeeksFromNow.setDate(currentDate.getDate() + 14);

      // Check if request is 2+ weeks in advance
      const isAutoApproved = requestStartDate >= twoWeeksFromNow;

      const userId = user.uid || user.id;
      // console.log("User object:", user);
      // console.log("Using user ID:", userId);
      // console.log("Company ID:", company.id);

      // Create the off request document
      const offRequestData = {
        workerId: userId,
        workerName: user.fullName,
        workerEmail: user.email,
        companyId: company.id,
        startDate: startDate,
        endDate: endDate || startDate,
        isAllDay,
        startTime: isAllDay ? null : startTime,
        endTime: isAllDay ? null : endTime,
        reason: reason.trim(),
        status: isAutoApproved ? "approved" : "pending",
        isAutoApproved,
        requestedAt: new Date().toISOString(),
        approvedAt: isAutoApproved ? new Date().toISOString() : null,
        approvedBy: isAutoApproved ? "system" : null,
      };

      // console.log("Request data being submitted:", offRequestData);

      // Add the request to the database
      await addDoc(collection(db, "offRequests"), offRequestData);

      // If auto-approved, apply to schedules immediately
      if (isAutoApproved) {
        await applyOffToSchedules(requestStartDate, requestEndDate, userId, {
          isAllDay,
          startTime: isAllDay ? null : startTime,
          endTime: isAllDay ? null : endTime,
        });
      }

      handleClose();
    } catch (err) {
      setError("Failed to submit request. Please try again.");
      console.error("Error submitting off request:", err);
    } finally {
      setLoading(false);
    }
  };

  const applyOffToSchedules = async (
    startDate,
    endDate,
    workerId,
    timeDetails
  ) => {
    // console.log("Auto-applying OFF to schedules:", {
    //   startDate: startDate.toDateString(),
    //   endDate: endDate.toDateString(),
    //   workerId,
    //   timeDetails,
    // });

    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      const sunday = getSundayOfWeek(current);
      const scheduleId = `${company.id}_${sunday.getFullYear()}-${String(
        sunday.getMonth() + 1
      ).padStart(2, "0")}-${String(sunday.getDate()).padStart(2, "0")}`;

      // console.log(
      //     "Processing date:",
      //     current.toDateString(),
      //     "Schedule ID:",
      //     scheduleId
      //   );

      try {
        // Get or create the schedule document
        const scheduleDocRef = doc(db, "schedules", scheduleId);
        const scheduleDoc = await getDocs(
          query(
            collection(db, "schedules"),
            where("__name__", "==", scheduleId)
          )
        );

        let scheduleData;
        if (scheduleDoc.empty) {
          // console.log("Creating new schedule document:", scheduleId);
          // Create new schedule if it doesn't exist
          scheduleData = {
            companyId: company.id,
            weekOf: sunday,
            isPublished: false,
            shifts: {},
          };
          await setDoc(scheduleDocRef, scheduleData);
        } else {
          scheduleData = scheduleDoc.docs[0].data();
          // console.log(
          //     "Found existing schedule, isPublished:",
          //     scheduleData.isPublished
          //   );

          // Skip if schedule is published
          if (scheduleData.isPublished) {
            // console.log(
            //   "Skipping published schedule for",
            //   current.toDateString()
            // );
            current.setDate(current.getDate() + 1);
            continue;
          }
        }

        // Determine the day of week for this date
        const dayOfWeek = current.getDay();
        const dayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
        const dayKey = dayKeys[dayOfWeek];

        // console.log("Adding OFF to day:", dayKey, "for worker:", workerId);

        // Create the OFF shift
        const offShift = {
          type: "OFF",
          isRequest: true,
          requestId: crypto.randomUUID(),
        };

        if (!timeDetails.isAllDay) {
          offShift.start = timeDetails.startTime;
          offShift.end = timeDetails.endTime;
        }

        // Update the schedule
        const updatedShifts = { ...scheduleData.shifts };
        if (!updatedShifts[workerId]) {
          updatedShifts[workerId] = {};
        }
        if (!updatedShifts[workerId][dayKey]) {
          updatedShifts[workerId][dayKey] = [];
        }

        // Add the OFF shift (allow multiple OFF shifts if needed)
        updatedShifts[workerId][dayKey].push(offShift);
        // console.log("Added OFF shift:", offShift);

        // Update the schedule document
        await setDoc(
          scheduleDocRef,
          { shifts: updatedShifts },
          { merge: true }
        );
        // console.log("Successfully updated schedule document");
      } catch (error) {
        console.error(
          "Error applying OFF to schedule for date",
          current.toDateString(),
          ":",
          error
        );
      }

      current.setDate(current.getDate() + 1);
    }

    // console.log("Finished applying OFF to all schedules");
  };

  const handleClose = () => {
    setStartDate("");
    setEndDate("");
    setIsAllDay(true);
    setStartTime("09:00");
    setEndTime("17:00");
    setReason("");
    setError("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          <div className="p-6">
            <h3 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Calendar size={24} />
              Request Time Off
            </h3>

            {error && (
              <p className="bg-red-100 text-red-700 p-3 rounded-md mb-4 text-center">
                {error}
              </p>
            )}

            <div className="space-y-4">
              {/* Date Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="startDate"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Start Date *
                  </label>
                  <input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    min={new Date().toISOString().split("T")[0]}
                    className="p-2 border rounded w-full"
                  />
                </div>
                <div>
                  <label
                    htmlFor="endDate"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    End Date (optional)
                  </label>
                  <input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate || new Date().toISOString().split("T")[0]}
                    className="p-2 border rounded w-full"
                  />
                </div>
              </div>

              {/* All Day Toggle */}
              <div className="flex items-center">
                <input
                  id="allDay"
                  type="checkbox"
                  checked={isAllDay}
                  onChange={(e) => setIsAllDay(e.target.checked)}
                  className="mr-2"
                />
                <label
                  htmlFor="allDay"
                  className="text-sm font-medium text-gray-700"
                >
                  All Day
                </label>
              </div>

              {/* Time Selection */}
              {!isAllDay && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="startTime"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Start Time
                    </label>
                    <input
                      id="startTime"
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="p-2 border rounded w-full"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="endTime"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      End Time
                    </label>
                    <input
                      id="endTime"
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="p-2 border rounded w-full"
                    />
                  </div>
                </div>
              )}

              {/* Reason */}
              <div>
                <label
                  htmlFor="reason"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Reason (optional)
                </label>
                <textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Brief reason for time off request..."
                  className="p-2 border rounded w-full h-20 resize-none"
                  maxLength={200}
                />
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <p className="text-sm text-blue-800">
                  <Clock size={16} className="inline mr-1" />
                  <strong>Note:</strong> Requests made 2+ weeks in advance will
                  be automatically approved. Requests within 2 weeks require
                  manager approval.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 p-3 flex justify-end space-x-3 rounded-b-lg">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-red-300"
            >
              {loading ? "Submitting..." : "Submit Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RequestOffModal;
