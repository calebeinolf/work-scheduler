// src/components/ShiftEditPopover.jsx

import React, { useState, useEffect, useRef } from "react";
import { Clock } from "lucide-react";
import { formatTime12hr } from "../utils/scheduleUtils";

const ShiftEditPopover = ({ targetCell, presets, onSave, onClose }) => {
  const { worker, initialShift } = targetCell;
  const [shifts, setShifts] = useState([]);
  const [editingCustomIndex, setEditingCustomIndex] = useState(null);
  const [customOffMode, setCustomOffMode] = useState(false);
  const [customOffTime, setCustomOffTime] = useState({
    start: "09:00",
    end: "17:00",
  });
  const popoverRef = useRef(null);

  useEffect(() => {
    let startingShifts = [];
    if (Array.isArray(initialShift)) {
      // Filter out OFF and SWIM MEET for editing - these are handled separately
      startingShifts = JSON.parse(
        JSON.stringify(
          initialShift.filter((s) => s.type !== "OFF" && s.type !== "SWIM MEET")
        )
      );
    }
    if (startingShifts.length === 0) {
      let defaultType = "GUARD";
      if (worker) {
        const title = worker.title.toLowerCase();
        if (title.includes("manager") || title.includes("head guard"))
          defaultType = "MANAGER";
        else if (title.includes("front")) defaultType = "FRONT";
        else if (title.includes("camp")) defaultType = "CAMP";
      }
      startingShifts.push({ start: "09:00", end: "17:00", type: defaultType });
    }
    setShifts(startingShifts);
  }, [initialShift, worker]);

  const handleShiftChange = (index, field, value) => {
    const newShifts = [...shifts];
    newShifts[index][field] = value;
    setShifts(newShifts);
  };

  const handlePredefinedClick = (index, preset) => {
    const newShifts = [...shifts];
    newShifts[index].start = preset.start;
    newShifts[index].end = preset.end;
    setShifts(newShifts);
    setEditingCustomIndex(null);
  };

  const addShift = () => {
    const lastShiftType =
      shifts.length > 0 ? shifts[shifts.length - 1].type : "GUARD";
    setShifts([
      ...shifts,
      { start: "09:00", end: "17:00", type: lastShiftType },
    ]);
  };

  const removeShift = (index) => {
    const newShifts = shifts.filter((_, i) => i !== index);
    setShifts(newShifts);
  };

  const handleSave = () => {
    const validShifts = shifts.filter((s) => s.start && s.end);

    // Preserve existing OFF and SWIM MEET statuses, including rule-based OFF shifts
    const existingStatuses = Array.isArray(initialShift)
      ? initialShift.filter((s) => s.type === "OFF" || s.type === "SWIM MEET")
      : [];

    const allShifts = [...existingStatuses, ...validShifts];
    onSave(allShifts.length > 0 ? allShifts : null);
  };

  const handleToggleStatus = (statusType) => {
    if (statusType === "CUSTOM_OFF") {
      setCustomOffMode(true);
      return;
    }

    const currentStatuses = Array.isArray(initialShift)
      ? initialShift.filter((s) => s.type === "OFF" || s.type === "SWIM MEET")
      : [];

    const hasStatus = currentStatuses.some(
      (s) => s.type === statusType && !s.isRule
    );

    let newStatuses;
    if (hasStatus) {
      // Remove the status (but preserve rule-based OFF shifts)
      newStatuses = currentStatuses.filter(
        (s) => !(s.type === statusType && !s.isRule)
      );
    } else {
      // Add the status
      newStatuses = [...currentStatuses, { type: statusType }];
    }

    // Get existing work shifts (not the edited ones in state)
    const existingWorkShifts = Array.isArray(initialShift)
      ? initialShift.filter((s) => s.type !== "OFF" && s.type !== "SWIM MEET")
      : [];

    const allShifts = [...newStatuses, ...existingWorkShifts];
    onSave(allShifts.length > 0 ? allShifts : null);
  };

  const handleCustomOffSave = () => {
    const customOffShift = {
      type: "OFF",
      start: customOffTime.start,
      end: customOffTime.end,
    };

    // Get existing statuses except manual OFF (preserve rule-based OFF and SWIM MEET)
    const currentStatuses = Array.isArray(initialShift)
      ? initialShift.filter(
          (s) => s.type === "SWIM MEET" || (s.type === "OFF" && s.isRule)
        )
      : [];

    // Get existing work shifts
    const existingWorkShifts = Array.isArray(initialShift)
      ? initialShift.filter((s) => s.type !== "OFF" && s.type !== "SWIM MEET")
      : [];

    const allShifts = [
      ...currentStatuses,
      customOffShift,
      ...existingWorkShifts,
    ];
    onSave(allShifts.length > 0 ? allShifts : null);
  };

  // Check if current day has OFF or SWIM MEET status
  const hasOffStatus =
    Array.isArray(initialShift) && initialShift.some((s) => s.type === "OFF");
  const hasSwimMeetStatus =
    Array.isArray(initialShift) &&
    initialShift.some((s) => s.type === "SWIM MEET");

  const getPopoverStyle = () => {
    if (!targetCell.rect) return { display: "none" };
    const popoverWidth = 320;
    const popoverHeight = popoverRef.current
      ? popoverRef.current.offsetHeight
      : 300;
    const margin = 12;
    let style = {
      top: `${targetCell.rect.top + window.scrollY}px`,
      left: `${targetCell.rect.right + window.scrollX + margin}px`,
    };
    if (targetCell.rect.right + popoverWidth + margin > window.innerWidth) {
      style.left = `${
        targetCell.rect.left + window.scrollX - popoverWidth - margin
      }px`;
    }
    if (targetCell.rect.top + popoverHeight > window.innerHeight) {
      style.top = `${
        window.innerHeight - popoverHeight - margin + window.scrollY
      }px`;
    }
    return style;
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target))
        onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Add keyboard handler for Enter to save
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (customOffMode) {
          handleCustomOffSave();
        } else {
          handleSave();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <div
      ref={popoverRef}
      className="absolute z-50 bg-white rounded-lg shadow-2xl border p-3 w-80"
      style={getPopoverStyle()}
    >
      <div className="space-y-2">
        {!customOffMode ? (
          <>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
              {shifts.map((shift, index) => {
                const applicablePresets = presets.filter((p) =>
                  p.applicableTo.includes(shift.type)
                );
                return (
                  <div
                    key={index}
                    className="p-2 border rounded-md space-y-2 bg-gray-50 relative"
                  >
                    <select
                      value={shift.type}
                      onChange={(e) =>
                        handleShiftChange(index, "type", e.target.value)
                      }
                      className="w-full p-1 border rounded-md bg-white"
                    >
                      <option>GUARD</option>
                      <option>MANAGER</option>
                      <option>FRONT</option>
                      <option>LESSONS</option>
                      <option>CAMP</option>
                    </select>
                    {editingCustomIndex === index ? (
                      <div className="flex items-center space-x-2">
                        <input
                          type="time"
                          value={shift.start}
                          onChange={(e) =>
                            handleShiftChange(index, "start", e.target.value)
                          }
                          className="w-full p-1 border rounded-md"
                        />
                        <span>-</span>
                        <input
                          type="time"
                          value={shift.end}
                          onChange={(e) =>
                            handleShiftChange(index, "end", e.target.value)
                          }
                          className="w-full p-1 border rounded-md"
                        />
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1 justify-center">
                        {applicablePresets.map((p) => {
                          const isSelected =
                            shift.start === p.start && shift.end === p.end;
                          return (
                            <button
                              key={p.id}
                              onClick={() => handlePredefinedClick(index, p)}
                              className={`text-xs px-2 py-1 rounded ${
                                isSelected
                                  ? "bg-black text-white"
                                  : "bg-gray-200 hover:bg-blue-200"
                              }`}
                            >
                              {`${formatTime12hr(p.start).replace(
                                /:00$/,
                                ""
                              )}-${formatTime12hr(p.end).replace(/:00$/, "")}`}
                            </button>
                          );
                        })}
                        <button
                          onClick={() => setEditingCustomIndex(index)}
                          className="text-xs px-2 py-1 bg-gray-200 hover:bg-blue-200 rounded"
                        >
                          Custom
                        </button>
                      </div>
                    )}
                    {shifts.length > 1 && (
                      <button
                        onClick={() => removeShift(index)}
                        className="absolute -top-1 -right-2 bg-red-500 z-100 text-white rounded-full h-5 w-5 flex items-center justify-center text-xs"
                      >
                        &times;
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex space-x-2">
              <button
                onClick={addShift}
                className="w-full text-sm p-1 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded"
              >
                + Another Shift
              </button>
              <button
                onClick={handleSave}
                className="w-full text-sm p-1 bg-blue-500 text-white rounded"
              >
                Save Shift
              </button>
            </div>
            <hr />
            <div className="flex space-x-2">
              <button
                onClick={() => onSave(null)}
                className="w-full text-sm text-center p-1 px-2 text-gray-700 bg-gray-200 hover:bg-gray-200 rounded"
              >
                Reset
              </button>
              <button
                onClick={() => handleToggleStatus("SWIM MEET")}
                className={`text-sm text-nowrap text-center p-1 px-2 rounded flex items-center justify-center gap-1 ${
                  hasSwimMeetStatus
                    ? "text-orange-600 bg-orange-200 border border-orange-400"
                    : "text-orange-600 bg-orange-100 hover:bg-orange-200"
                }`}
              >
                {hasSwimMeetStatus && (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="20,6 9,17 4,12"></polyline>
                  </svg>
                )}
                Swim Meet
              </button>
              <button
                onClick={() => handleToggleStatus("OFF")}
                className={`w-full text-sm text-center p-1 px-2 rounded flex items-center justify-center gap-1 ${
                  hasOffStatus
                    ? "text-red-600 bg-red-200 border border-red-400"
                    : "text-red-600 bg-red-100 hover:bg-red-200"
                }`}
              >
                {hasOffStatus && (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="20,6 9,17 4,12"></polyline>
                  </svg>
                )}
                OFF
              </button>
              <button
                onClick={() => handleToggleStatus("CUSTOM_OFF")}
                className="text-sm text-center p-1 px-2 rounded flex items-center justify-center gap-1 text-red-600 bg-red-100 hover:bg-red-200"
              >
                <Clock width={15} />
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <div className="text-sm font-medium text-gray-700 text-center">
              Set Custom OFF Time
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="time"
                value={customOffTime.start}
                onChange={(e) =>
                  setCustomOffTime((prev) => ({
                    ...prev,
                    start: e.target.value,
                  }))
                }
                className="w-full p-2 border rounded-md"
              />
              <span className="text-gray-500">to</span>
              <input
                type="time"
                value={customOffTime.end}
                onChange={(e) =>
                  setCustomOffTime((prev) => ({
                    ...prev,
                    end: e.target.value,
                  }))
                }
                className="w-full p-2 border rounded-md"
              />
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setCustomOffMode(false)}
                className="w-full text-sm p-1 bg-gray-200 hover:bg-gray-300 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleCustomOffSave}
                className="w-full text-sm p-1 bg-red-100 hover:bg-red-200 text-red-600 rounded"
              >
                Set Custom OFF
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShiftEditPopover;
