// src/components/ScheduleView.jsx

import React, { useState, useEffect, useMemo, useRef } from "react";
import { onSnapshot, doc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

// --- Time formatting and calculation helpers ---
const formatTime12hr = (time24) => {
  if (!time24) return "";
  const [hours, minutes] = time24.split(":");
  const h = parseInt(hours, 10);
  const newHours = h % 12 === 0 ? 12 : h % 12;
  return `${newHours}:${minutes}`;
};

const calculateDailyHours = (dayShifts, isMinor) => {
  if (
    !Array.isArray(dayShifts) ||
    dayShifts.length === 0 ||
    dayShifts[0]?.type === "OFF"
  ) {
    return 0;
  }

  // 1. Convert to minute-based intervals and filter out invalid shifts
  const intervals = dayShifts
    .map((shift) => {
      if (!shift.start || !shift.end) return null;
      const [startH, startM] = shift.start.split(":").map(Number);
      const [endH, endM] = shift.end.split(":").map(Number);
      return { start: startH * 60 + startM, end: endH * 60 + endM };
    })
    .filter(Boolean)
    .sort((a, b) => a.start - b.start); // Sort intervals by start time

  if (intervals.length === 0) return 0;

  // 2. Merge overlapping intervals
  const mergedIntervals = [intervals[0]];
  for (let i = 1; i < intervals.length; i++) {
    const lastMerged = mergedIntervals[mergedIntervals.length - 1];
    const current = intervals[i];
    if (current.start < lastMerged.end) {
      // Check for overlap
      lastMerged.end = Math.max(lastMerged.end, current.end);
    } else {
      mergedIntervals.push(current);
    }
  }

  // 3. Calculate total duration from merged intervals
  let totalMinutes = 0;
  for (const interval of mergedIntervals) {
    totalMinutes += interval.end - interval.start;
  }

  let durationInHours = totalMinutes / 60;

  // 4. Apply break logic to the total merged duration
  const breakThreshold = isMinor ? 5 : 8;
  if (durationInHours > breakThreshold) {
    const timeOverThreshold = durationInHours - breakThreshold;
    if (timeOverThreshold <= 0.5) {
      return breakThreshold;
    } else {
      return durationInHours - 0.5;
    }
  }

  return durationInHours;
};

// --- Helper to categorize shifts for counting and highlighting ---
const getShiftCategory = (shift) => {
  if (!shift || !shift.start || !shift.end) return null;
  const openingTime = "13:00"; // 1:00 PM
  const closingTime = "18:00"; // 6:00 PM

  const isOpening = shift.start <= openingTime;
  const isClosing = shift.end >= closingTime;

  if (isOpening && isClosing) return "All Day";
  if (isOpening) return "Opening";
  if (isClosing) return "Closing";
  return "Midday";
};

// --- Shift Edit Popover Component for Multiple Shifts ---
const ShiftEditPopover = ({ targetCell, presets, onSave, onClose }) => {
  const { worker, initialShift } = targetCell;
  const [shifts, setShifts] = useState([]);
  const [editingCustomIndex, setEditingCustomIndex] = useState(null);
  const popoverRef = useRef(null);
  const [activeShiftType, setActiveShiftType] = useState("GUARD");

  const applicablePresets = useMemo(() => {
    return presets.filter((p) => p.applicableTo.includes(activeShiftType));
  }, [presets, activeShiftType]);

  useEffect(() => {
    let startingShifts = [];
    if (Array.isArray(initialShift)) {
      startingShifts = JSON.parse(
        JSON.stringify(initialShift.filter((s) => s.type !== "OFF"))
      );
    }

    if (startingShifts.length > 0) {
      setActiveShiftType(startingShifts[0].type);
    } else {
      let defaultType = "GUARD";
      if (worker) {
        const title = worker.title.toLowerCase();
        if (title.includes("manager") || title.includes("head guard"))
          defaultType = "MANAGER";
        else if (title.includes("front")) defaultType = "FRONT";
      }
      setActiveShiftType(defaultType);
      startingShifts.push({ start: "09:00", end: "17:00", type: defaultType });
    }
    setShifts(startingShifts);
  }, [initialShift, worker]);

  const handleShiftChange = (index, field, value) => {
    const newShifts = [...shifts];
    newShifts[index][field] = value;
    if (field === "type") setActiveShiftType(value); // Update active type for filtering presets
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
    setShifts([
      ...shifts,
      { start: "09:00", end: "17:00", type: activeShiftType },
    ]);
  };

  const removeShift = (index) => {
    const newShifts = shifts.filter((_, i) => i !== index);
    setShifts(newShifts);
  };

  const handleSave = () => {
    const validShifts = shifts.filter((s) => s.start && s.end);
    onSave(validShifts.length > 0 ? validShifts : null);
  };

  const getPopoverStyle = () => {
    if (!targetCell.rect) return { display: "none" };
    const popoverWidth = 320; // w-80
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

  return (
    <div
      ref={popoverRef}
      className="absolute z-20 bg-white rounded-lg shadow-2xl border p-3 w-80"
      style={getPopoverStyle()}
    >
      <div className="space-y-3">
        <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
          {shifts.map((shift, index) => (
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
          ))}
        </div>
        <button
          onClick={addShift}
          className="w-full text-sm p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded"
        >
          + Add Shift Time
        </button>
        <hr />
        <div className="flex space-x-2">
          <button
            onClick={() => onSave(null)}
            className="w-full text-sm text-center p-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded"
          >
            Reset
          </button>
          <button
            onClick={() => onSave([{ type: "OFF" }])}
            className="w-full text-sm text-center p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded"
          >
            Set as OFF
          </button>
        </div>
        <button
          onClick={handleSave}
          className="w-full text-sm p-2 bg-blue-500 text-white rounded"
        >
          Save All Changes
        </button>
      </div>
    </div>
  );
};

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
              <span className="font-semibold text-gray-600">Email:</span>
              <span className="text-gray-800">
                {worker.email || "Not provided"}
              </span>
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
const WorkerRow = ({
  worker,
  scheduleData,
  onWorkerClick,
  hoveredCell,
  popoverTarget,
  onCellEnter,
  onCellClick,
  revealedHoursWorkerId,
  onRevealHoursStart,
  onRevealHoursEnd,
}) => {
  const getCellClass = (colKey) => {
    if (
      popoverTarget &&
      popoverTarget.worker.uid === worker.uid &&
      popoverTarget.day === colKey
    ) {
      return "bg-gray-800";
    }
    const isRowHovered = hoveredCell.row === worker.uid;
    const isColHovered = hoveredCell.col === colKey;
    if (hoveredCell.col === "name") return isRowHovered ? "bg-blue-100" : "";
    if (isRowHovered && isColHovered) return "bg-blue-200";
    if (isRowHovered || isColHovered) return "bg-blue-100";
    return "";
  };

  const getShiftHighlightClass = (shift) => {
    if (shift.type === "LESSONS") return "";
    const category = getShiftCategory(shift);
    switch (category) {
      case "All Day":
        return "bg-green-100";
      case "Opening":
        return "bg-yellow-100";
      case "Closing":
        return "bg-purple-100";
      default:
        return "";
    }
  };

  const shouldShowShiftType = (shift, worker) => {
    if (!shift || !worker || !shift.type || !worker.title) return false;
    if (shift.type === "LESSONS") return true;
    if (worker.title.includes("Lifeguard") && shift.type === "GUARD")
      return false;
    if (worker.title.includes("Front") && shift.type === "FRONT") return false;
    return true;
  };

  const handleMouseEnter = (rowId, colId) => {
    if (!popoverTarget) onCellEnter({ row: rowId, col: colId });
  };

  const weeklyShifts = scheduleData[worker.uid];
  const weeklyTotal = useMemo(() => {
    if (!weeklyShifts) return 0;
    let totalHours = 0;
    Object.values(weeklyShifts).forEach((dayShifts) => {
      totalHours += calculateDailyHours(dayShifts, worker.isMinor);
    });
    return totalHours;
  }, [weeklyShifts, worker.isMinor]);

  return (
    <tr key={worker.uid}>
      <td
        className={`p-1 border font-medium cursor-pointer transition-colors duration-150 ${getCellClass(
          "name"
        )}`}
        onClick={() => onWorkerClick(worker)}
        onMouseEnter={() => handleMouseEnter(worker.uid, "name")}
      >
        {worker.fullName || worker.email}
        {worker.isMinor && (
          <span className="text-gray-500 font-medium ml-1">(M)</span>
        )}
        {worker.title &&
          worker.title !== "Lifeguard" &&
          worker.title !== "Front Worker" && (
            <div className="text-xs text-gray-500">{worker.title}</div>
          )}
      </td>
      <td
        className={`p-1 border text-center transition-colors duration-150 ${getCellClass(
          "yos"
        )}`}
        onMouseEnter={() => handleMouseEnter(worker.uid, "yos")}
      >
        {worker.yos ?? 0}
      </td>
      {["sat", "sun", "mon", "tue", "wed", "thu", "fri"].map((day) => {
        const dayShifts = weeklyShifts?.[day];
        const isRevealed = revealedHoursWorkerId === worker.uid;
        let dailyTotalHours = 0;
        if (isRevealed) {
          dailyTotalHours = calculateDailyHours(dayShifts, worker.isMinor);
        }

        return (
          <td
            key={day}
            className={`p-1 border text-center cursor-pointer transition-colors duration-150 ${getCellClass(
              day
            )}`}
            onMouseEnter={() => handleMouseEnter(worker.uid, day)}
            onClick={(e) => onCellClick(e, worker, day)}
          >
            {isRevealed ? (
              dailyTotalHours > 0 ? (
                <div className="font-semibold text-blue-600 h-full flex items-center justify-center">
                  {dailyTotalHours.toFixed(2)}
                </div>
              ) : (
                <span className="text-gray-400">0</span>
              )
            ) : Array.isArray(dayShifts) ? (
              dayShifts[0]?.type === "OFF" ? (
                <div className="font-semibold text-sm text-red-500 h-full flex items-center justify-center">
                  OFF
                </div>
              ) : (
                <div>
                  {dayShifts.map((shift, index) => (
                    <div
                      key={index}
                      className={`text-sm rounded-md p-0.5 flex items-center gap-1 justify-center text-nowrap ${getShiftHighlightClass(
                        shift
                      )}`}
                    >
                      <div>{`${formatTime12hr(shift.start)} - ${formatTime12hr(
                        shift.end
                      )}`}</div>
                      {shouldShowShiftType(shift, worker) && (
                        <div className="text-gray-500">({shift.type[0]})</div>
                      )}
                    </div>
                  ))}
                </div>
              )
            ) : (
              <span className="text-gray-400">-</span>
            )}
          </td>
        );
      })}
      <td
        className={`p-1 border ${
          weeklyTotal > 40 && "text-red-500"
        } text-center font-medium cursor-pointer transition-colors duration-150 ${getCellClass(
          "total"
        )}`}
        onMouseEnter={() => handleMouseEnter(worker.uid, "total")}
        onMouseDown={() => onRevealHoursStart(worker.uid)}
        onMouseUp={onRevealHoursEnd}
        onMouseLeave={onRevealHoursEnd}
      >
        {weeklyTotal.toFixed(2)}
      </td>
    </tr>
  );
};

const ScheduleView = ({ company, workers, presets }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [scheduleData, setScheduleData] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [hoveredCell, setHoveredCell] = useState({ row: null, col: null });
  const [popoverTarget, setPopoverTarget] = useState(null);
  const [revealedHoursWorkerId, setRevealedHoursWorkerId] = useState(null);

  const weekStartDate = useMemo(
    () => getSaturdayOfWeek(currentDate),
    [currentDate]
  );

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
      if (orderA !== orderB) return orderA - orderB;
      return (b.yos || 0) - (a.yos || 0);
    };
    const allWorkers = [...workers];
    allWorkers.sort(sortLogic);

    return {
      sortedManagersAndGuards: allWorkers.filter(
        (w) => w.title !== "Front Worker"
      ),
      sortedFrontWorkers: allWorkers.filter((w) => w.title === "Front Worker"),
    };
  }, [workers]);

  const dailyStaffCounts = useMemo(() => {
    const counts = {};
    const dayKeys = ["sat", "sun", "mon", "tue", "wed", "thu", "fri"];

    const calculateCountsForType = (shiftType) => {
      dayKeys.forEach((day) => {
        let openingCount = 0;
        let closingCount = 0;

        workers.forEach((worker) => {
          const dayShifts = scheduleData[worker.uid]?.[day];
          if (Array.isArray(dayShifts)) {
            dayShifts.forEach((shift) => {
              if (shift.type === shiftType) {
                const category = getShiftCategory(shift);
                if (category === "Opening" || category === "All Day")
                  openingCount++;
                if (category === "Closing" || category === "All Day")
                  closingCount++;
              }
            });
          }
        });

        if (!counts[day]) counts[day] = {};
        counts[day][shiftType] =
          openingCount === closingCount
            ? `${openingCount}`
            : `${openingCount}-${closingCount}`;
      });
    };

    calculateCountsForType("GUARD");
    calculateCountsForType("FRONT");

    return counts;
  }, [scheduleData, workers]);

  const scheduleDocId = useMemo(() => {
    if (!company?.id) return null;
    const weekId = weekStartDate.toISOString().split("T")[0];
    return `${company.id}_${weekId}`;
  }, [company, weekStartDate]);

  useEffect(() => {
    if (!scheduleDocId) return;
    setLoading(true);
    const scheduleDocRef = doc(db, "schedules", scheduleDocId);
    const unsubscribe = onSnapshot(scheduleDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setScheduleData(docSnap.data().shifts || {});
      } else {
        const initialShifts = {};
        workers.forEach((w) => {
          if (w.uid) {
            initialShifts[w.uid] = {
              sat: null,
              sun: null,
              mon: null,
              tue: null,
              wed: null,
              thu: null,
              fri: null,
            };
          }
        });
        if (Object.keys(initialShifts).length > 0) {
          setDoc(scheduleDocRef, {
            companyId: company.id,
            weekOf: weekStartDate,
            isPublished: false,
            shifts: initialShifts,
          });
        }
        setScheduleData(initialShifts);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [scheduleDocId, workers, company, weekStartDate]);

  const handleCellClick = (event, worker, day) => {
    event.stopPropagation();
    const currentShift = scheduleData[worker.uid]?.[day] || null;
    setPopoverTarget({
      worker,
      day,
      initialShift: currentShift,
      rect: event.currentTarget.getBoundingClientRect(),
    });
    setHoveredCell({ row: worker.uid, col: day });
  };

  const handleClosePopover = () => {
    setPopoverTarget(null);
    setHoveredCell({ row: null, col: null });
  };

  const handleSaveShift = async (newShiftData) => {
    if (!popoverTarget || !scheduleDocId) return;
    const { worker, day } = popoverTarget;
    const scheduleDocRef = doc(db, "schedules", scheduleDocId);
    const fieldPath = `shifts.${worker.uid}.${day}`;
    try {
      await updateDoc(scheduleDocRef, { [fieldPath]: newShiftData });
    } catch (error) {
      console.error("Failed to save shift:", error);
    } finally {
      handleClosePopover();
    }
  };

  const handleWeekChange = (weeks) => {
    setCurrentDate((prevDate) => {
      const newDate = new Date(prevDate);
      newDate.setDate(newDate.getDate() + weeks * 7);
      return newDate;
    });
  };

  const handleHeaderMouseEnter = (colId) => {
    if (!popoverTarget) setHoveredCell({ row: null, col: colId });
  };

  const renderWeekHeader = () => {
    const days = ["sat", "sun", "mon", "tue", "wed", "thu", "fri"];
    const displayDays = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];
    const headerDates = [];
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(weekStartDate);
      dayDate.setDate(dayDate.getDate() + i);
      headerDates.push(
        `${displayDays[i]} ${dayDate.getMonth() + 1}/${dayDate.getDate()}`
      );
    }
    return (
      <tr className="bg-gray-100">
        <th
          className={`p-2 border text-left text-sm font-semibold text-gray-600 min-w-[160px] bg-gray-100`}
          onMouseEnter={() => handleHeaderMouseEnter("name")}
        >
          Worker
        </th>
        <th
          className={`p-2 border text-sm font-semibold text-gray-600 transition-colors duration-150 ${
            hoveredCell.col === "yos" ? "bg-blue-100" : "bg-gray-100"
          }`}
          onMouseEnter={() => handleHeaderMouseEnter("yos")}
        >
          YOS
        </th>
        {days.map((dayKey, i) => (
          <th
            key={dayKey}
            className={`p-2 border text-sm font-semibold text-gray-600 transition-colors duration-150 ${
              hoveredCell.col === dayKey ? "bg-blue-100" : "bg-gray-100"
            }`}
            onMouseEnter={() => handleHeaderMouseEnter(dayKey)}
          >
            <div>{headerDates[i]}</div>
            <div className="flex items-center justify-center gap-3">
              <div className="text-blue-600 font-bold text-xs mt-1">
                {dailyStaffCounts[dayKey]?.GUARD || "0"}{" "}
                <span className="font-medium"> G</span>
              </div>
              <div className="text-green-600 font-bold text-xs mt-1">
                {dailyStaffCounts[dayKey]?.FRONT || "0"}{" "}
                <span className="font-medium"> F</span>
              </div>
            </div>
          </th>
        ))}
        <th
          className={`p-2 border text-sm font-semibold text-gray-600 transition-colors duration-150 ${
            hoveredCell.col === "total" ? "bg-blue-100" : "bg-gray-100"
          }`}
          onMouseEnter={() => handleHeaderMouseEnter("total")}
        >
          Hours
        </th>
      </tr>
    );
  };

  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekStartDate.getDate() + 6);

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <WorkerDetailModal
        worker={selectedWorker}
        onClose={() => setSelectedWorker(null)}
      />
      {popoverTarget && (
        <ShiftEditPopover
          targetCell={popoverTarget}
          presets={presets}
          onSave={handleSaveShift}
          onClose={handleClosePopover}
        />
      )}
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
        <table
          className="w-full border-collapse border"
          onMouseLeave={() => {
            if (!popoverTarget) setHoveredCell({ row: null, col: null });
          }}
        >
          <thead>{renderWeekHeader()}</thead>
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
                  hoveredCell={hoveredCell}
                  popoverTarget={popoverTarget}
                  onCellEnter={setHoveredCell}
                  onCellClick={handleCellClick}
                  revealedHoursWorkerId={revealedHoursWorkerId}
                  onRevealHoursStart={setRevealedHoursWorkerId}
                  onRevealHoursEnd={() => setRevealedHoursWorkerId(null)}
                />
              ))
            )}
          </tbody>
          {sortedFrontWorkers.length > 0 && (
            <tbody className="border-t-4 border-gray-300">
              {sortedFrontWorkers.map((worker) => (
                <WorkerRow
                  key={worker.uid}
                  worker={worker}
                  scheduleData={scheduleData}
                  onWorkerClick={setSelectedWorker}
                  hoveredCell={hoveredCell}
                  popoverTarget={popoverTarget}
                  onCellEnter={setHoveredCell}
                  onCellClick={handleCellClick}
                  revealedHoursWorkerId={revealedHoursWorkerId}
                  onRevealHoursStart={setRevealedHoursWorkerId}
                  onRevealHoursEnd={() => setRevealedHoursWorkerId(null)}
                />
              ))}
            </tbody>
          )}
        </table>
      </div>
    </div>
  );
};

export default ScheduleView;
