// src/components/OffRulesModal.jsx

import React, { useState, useEffect } from "react";
import {
  doc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  setDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { Trash2, Plus, Clock } from "lucide-react";
import { formatTime12hr, getSundayOfWeek } from "../utils/scheduleUtils";

const OffRulesModal = ({ worker, company, isOpen, onClose }) => {
  const [offRules, setOffRules] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);

  const daysOfWeek = [
    { key: "sun", label: "Sunday" },
    { key: "mon", label: "Monday" },
    { key: "tue", label: "Tuesday" },
    { key: "wed", label: "Wednesday" },
    { key: "thu", label: "Thursday" },
    { key: "fri", label: "Friday" },
    { key: "sat", label: "Saturday" },
  ];

  useEffect(() => {
    if (worker) {
      setOffRules(worker.offRules || []);
    }
  }, [worker]);

  // Prevent body scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      // Store original overflow style
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = "hidden";

      // Cleanup function to restore original overflow
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [isOpen]);

  const addOffRule = () => {
    const newRule = {
      id: crypto.randomUUID(),
      day: "sun",
      allDay: true,
      startTime: "09:00",
      endTime: "17:00",
    };
    setOffRules([...offRules, newRule]);
  };

  const removeOffRule = (id) => {
    setOffRules(offRules.filter((rule) => rule.id !== id));
  };

  const updateOffRule = (id, field, value) => {
    setOffRules(
      offRules.map((rule) =>
        rule.id === id ? { ...rule, [field]: value } : rule
      )
    );
  };

  const applyOffRulesToFutureSchedules = async (rulesToApply) => {
    if (!company?.id || !worker?.uid) return;

    // Get current date and find all future non-published schedules
    const today = new Date();
    const currentSunday = getSundayOfWeek(today);

    // Get all schedules for this company
    const schedulesQuery = query(
      collection(db, "schedules"),
      where("companyId", "==", company.id)
    );

    const schedulesSnapshot = await getDocs(schedulesQuery);
    const scheduleUpdates = [];

    schedulesSnapshot.docs.forEach((scheduleDoc) => {
      const scheduleData = scheduleDoc.data();
      const scheduleId = scheduleDoc.id;

      // Parse schedule date from ID (format: companyId_YYYY-MM-DD)
      const datePart = scheduleId.split("_")[1];
      if (!datePart) return;

      const [year, month, day] = datePart.split("-").map(Number);
      const scheduleDate = new Date(year, month - 1, day);

      // Only apply to future schedules that are not published
      if (scheduleDate < currentSunday || scheduleData.isPublished) return;

      // Apply OFF rules to this schedule
      let hasChanges = false;
      const updatedShifts = { ...scheduleData.shifts };

      if (!updatedShifts[worker.uid]) {
        updatedShifts[worker.uid] = {};
      }

      rulesToApply.forEach((rule) => {
        const currentShifts = updatedShifts[worker.uid][rule.day] || [];

        // Remove any existing OFF shifts created by rules (to avoid duplicates)
        const filteredShifts = Array.isArray(currentShifts)
          ? currentShifts.filter(
              (shift) => !(shift.type === "OFF" && shift.isRule)
            )
          : [];

        // Add the new OFF rule
        const offShift = {
          type: "OFF",
          isRule: true, // Mark as created by rule
          ruleId: rule.id,
        };

        if (!rule.allDay) {
          offShift.start = rule.startTime;
          offShift.end = rule.endTime;
        }

        filteredShifts.push(offShift);
        updatedShifts[worker.uid][rule.day] = filteredShifts;
        hasChanges = true;
      });

      if (hasChanges) {
        scheduleUpdates.push({
          docId: scheduleId,
          shifts: updatedShifts,
        });
      }
    });

    // Apply all updates
    for (const update of scheduleUpdates) {
      await setDoc(
        doc(db, "schedules", update.docId),
        { shifts: update.shifts },
        { merge: true }
      );
    }
  };

  const removeOffRulesFromFutureSchedules = async (ruleIdsToRemove) => {
    if (!company?.id || !worker?.uid) return;

    const today = new Date();
    const currentSunday = getSundayOfWeek(today);

    const schedulesQuery = query(
      collection(db, "schedules"),
      where("companyId", "==", company.id)
    );

    const schedulesSnapshot = await getDocs(schedulesQuery);
    const scheduleUpdates = [];

    schedulesSnapshot.docs.forEach((scheduleDoc) => {
      const scheduleData = scheduleDoc.data();
      const scheduleId = scheduleDoc.id;

      const datePart = scheduleId.split("_")[1];
      if (!datePart) return;

      const [year, month, day] = datePart.split("-").map(Number);
      const scheduleDate = new Date(year, month - 1, day);

      if (scheduleDate < currentSunday || scheduleData.isPublished) return;

      let hasChanges = false;
      const updatedShifts = { ...scheduleData.shifts };

      if (updatedShifts[worker.uid]) {
        Object.keys(updatedShifts[worker.uid]).forEach((dayKey) => {
          const dayShifts = updatedShifts[worker.uid][dayKey];
          if (Array.isArray(dayShifts)) {
            const filteredShifts = dayShifts.filter(
              (shift) =>
                !(
                  shift.type === "OFF" &&
                  shift.isRule &&
                  ruleIdsToRemove.includes(shift.ruleId)
                )
            );

            if (filteredShifts.length !== dayShifts.length) {
              updatedShifts[worker.uid][dayKey] =
                filteredShifts.length > 0 ? filteredShifts : null;
              hasChanges = true;
            }
          }
        });
      }

      if (hasChanges) {
        scheduleUpdates.push({
          docId: scheduleId,
          shifts: updatedShifts,
        });
      }
    });

    for (const update of scheduleUpdates) {
      await setDoc(
        doc(db, "schedules", update.docId),
        { shifts: update.shifts },
        { merge: true }
      );
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setError("");
    setApplying(true);

    try {
      // Get original rules to compare
      const originalRules = worker.offRules || [];

      // Find rules that were removed
      const removedRuleIds = originalRules
        .filter(
          (originalRule) =>
            !offRules.find((rule) => rule.id === originalRule.id)
        )
        .map((rule) => rule.id);

      // Find rules that were added or modified
      const newOrModifiedRules = offRules.filter((rule) => {
        const originalRule = originalRules.find((orig) => orig.id === rule.id);
        return (
          !originalRule || JSON.stringify(originalRule) !== JSON.stringify(rule)
        );
      });

      // Update worker document with new off rules
      const workerDocRef = doc(db, "users", worker.uid);
      await updateDoc(workerDocRef, {
        offRules: offRules,
      });

      // Remove old rules from future schedules
      if (removedRuleIds.length > 0) {
        await removeOffRulesFromFutureSchedules(removedRuleIds);
      }

      // Apply new/modified rules to future schedules
      if (newOrModifiedRules.length > 0) {
        await applyOffRulesToFutureSchedules(newOrModifiedRules);
      }

      onClose();
    } catch (err) {
      setError("Failed to save OFF rules. Please try again.");
      console.error("Error saving OFF rules:", err);
    } finally {
      setLoading(false);
      setApplying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      style={{ overflowY: "auto" }}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-200 shrink-0">
          <h3 className="text-2xl font-bold text-gray-800">
            OFF Rules for {worker?.fullName}
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Set recurring OFF times that will automatically apply to future,
            non-published schedules.
          </p>
        </div>

        <div className="p-6 overflow-y-auto grow">
          {error && (
            <div className="bg-red-100 text-red-700 p-3 rounded-md mb-4">
              {error}
            </div>
          )}

          {applying && (
            <div className="bg-blue-100 text-blue-700 p-3 rounded-md mb-4">
              Applying rules to future schedules...
            </div>
          )}

          <div className="space-y-4">
            {offRules.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <Clock size={48} className="mx-auto mb-3 text-gray-400" />
                <p>No OFF rules set</p>
                <p className="text-sm">
                  Click "Add Rule" to create a recurring OFF schedule.
                </p>
              </div>
            ) : (
              offRules.map((rule, index) => (
                <div key={rule.id} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-800">
                      Rule {index + 1} -{" "}
                      {daysOfWeek.find((d) => d.key === rule.day)?.label}s{" "}
                      {rule.allDay
                        ? "OFF (All Day)"
                        : `OFF ${formatTime12hr(
                            rule.startTime
                          )}-${formatTime12hr(rule.endTime)}`}
                    </h4>
                    <button
                      onClick={() => removeOffRule(rule.id)}
                      className="text-red-500 hover:text-red-700 p-1"
                      title="Remove rule"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Day of Week
                  </label>
                  <div className="flex gap-4 items-center">
                    {/* Day picker */}
                    <div className="w-full max-w-3xs">
                      <select
                        value={rule.day}
                        onChange={(e) =>
                          updateOffRule(rule.id, "day", e.target.value)
                        }
                        className="w-full p-2 border rounded-md"
                      >
                        {daysOfWeek.map((day) => (
                          <option key={day.key} value={day.key}>
                            {day.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* All Day checkbox */}
                    <div className="flex items-center mt-6 md:mt-0 ">
                      <input
                        id={`allday-${rule.id}`}
                        type="checkbox"
                        checked={rule.allDay}
                        onChange={(e) =>
                          updateOffRule(rule.id, "allDay", e.target.checked)
                        }
                        className="mr-2 cursor-pointer"
                      />
                      <label
                        htmlFor={`allday-${rule.id}`}
                        className="text-sm font-medium text-gray-700 select-none"
                      >
                        All Day
                      </label>
                    </div>
                  </div>

                  {/* Time Range picker */}
                  {!rule.allDay && (
                    <div className="md:col-span-1 mt-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Time Range
                      </label>
                      <div className="flex items-center gap-2 flex-wrap max-w-md">
                        <input
                          type="time"
                          value={rule.startTime}
                          onChange={(e) =>
                            updateOffRule(rule.id, "startTime", e.target.value)
                          }
                          className="flex-1 p-2 border rounded-md text-sm"
                        />
                        <span className="text-gray-500">to</span>
                        <input
                          type="time"
                          value={rule.endTime}
                          onChange={(e) =>
                            updateOffRule(rule.id, "endTime", e.target.value)
                          }
                          className="flex-1 p-2 border rounded-md text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}

            <button
              onClick={addOffRule}
              className=" w-full p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md"
            >
              + Add New OFF Rule
            </button>
          </div>
        </div>

        <div className="bg-gray-50 border-t border-gray-200 p-4 flex justify-end space-x-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300"
          >
            {loading ? "Saving..." : "Save OFF Rules"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OffRulesModal;
