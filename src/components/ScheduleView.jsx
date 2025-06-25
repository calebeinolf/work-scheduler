// src/components/ScheduleView.jsx

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import EditWorkerModal from "./EditWorkerModal";
import {
  ArrowLeft,
  ArrowRight,
  Printer,
  Redo,
  Redo2,
  Undo,
  Undo2,
  X,
  Send, // Publish Icon
  EyeOff, // Unpublish Icon
  CloudUpload,
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
  Ellipsis,
  EllipsisVertical,
} from "lucide-react";

// --- Deep object comparison helper ---
function deepEqual(objA, objB) {
  if (objA === objB) return true;

  if (
    objA === null ||
    objA === undefined ||
    objB === null ||
    objB === undefined
  ) {
    return objA === objB;
  }

  if (objA.constructor !== objB.constructor) return false;

  if (Array.isArray(objA)) {
    if (objA.length !== objB.length) return false;
    for (let i = 0; i < objA.length; i++) {
      if (!deepEqual(objA[i], objB[i])) return false;
    }
    return true;
  }

  if (typeof objA === "object") {
    const keysA = Object.keys(objA);
    const keysB = Object.keys(objB);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
      if (!keysB.includes(key) || !deepEqual(objA[key], objB[key])) {
        return false;
      }
    }
    return true;
  }

  return false;
}

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
  const intervals = dayShifts
    .map((shift) => {
      if (!shift.start || !shift.end) return null;
      const [startH, startM] = shift.start.split(":").map(Number);
      const [endH, endM] = shift.end.split(":").map(Number);
      return { start: startH * 60 + startM, end: endH * 60 + endM };
    })
    .filter(Boolean)
    .sort((a, b) => a.start - b.start);
  if (intervals.length === 0) return 0;
  const mergedIntervals = [intervals[0]];
  for (let i = 1; i < intervals.length; i++) {
    const lastMerged = mergedIntervals[mergedIntervals.length - 1];
    const current = intervals[i];
    if (current.start < lastMerged.end) {
      lastMerged.end = Math.max(lastMerged.end, current.end);
    } else {
      mergedIntervals.push(current);
    }
  }
  let totalMinutes = 0;
  for (const interval of mergedIntervals) {
    totalMinutes += interval.end - interval.start;
  }
  let durationInHours = totalMinutes / 60;
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
  const openingTime = "13:00";
  const closingTime = "18:00";
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

  useEffect(() => {
    let startingShifts = [];
    if (Array.isArray(initialShift)) {
      startingShifts = JSON.parse(
        JSON.stringify(initialShift.filter((s) => s.type !== "OFF"))
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
    onSave(validShifts.length > 0 ? validShifts : null);
  };

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
        handleSave();
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
                  <option>SWIM MEET</option>
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
        <button
          onClick={addShift}
          className="w-full text-sm p-1 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded"
        >
          + Add Another Shift
        </button>
        <hr />
        <div className="flex space-x-2">
          <button
            onClick={() => onSave(null)}
            className="w-full text-sm text-center p-1 text-gray-700 bg-gray-200 hover:bg-gray-200 rounded"
          >
            Reset
          </button>
          <button
            onClick={() => onSave([{ type: "SWIM MEET" }])}
            className="w-full text-sm text-center p-1 text-orange-600 bg-orange-100 hover:bg-orange-200 rounded"
          >
            Swim Meet
          </button>
          <button
            onClick={() => onSave([{ type: "OFF" }])}
            className="w-full text-sm text-center p-1 text-red-600 bg-red-100 hover:bg-red-200 rounded"
          >
            OFF
          </button>
        </div>
        <button
          onClick={handleSave}
          className="w-full text-sm p-1 bg-blue-500 text-white rounded"
        >
          Save All Changes
        </button>
      </div>
    </div>
  );
};

// --- Helper to get the start of a week (Sunday) for any given date ---
const getSundayOfWeek = (d) => {
  const date = new Date(d);
  const day = date.getDay(); // Sunday - Saturday : 0 - 6
  const diff = date.getDate() - day;
  return new Date(date.setDate(diff));
};

// --- Worker Details Modal Component ---
const WorkerDetailModal = ({
  worker,
  onClose,
  onEdit,
  onDelete,
  isManager,
}) => {
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
          {isManager && (
            <p className="text-gray-500">
              {worker.isMinor ? "Minor" : "Adult"}
            </p>
          )}
          <div className="mt-6 space-y-3 text-xs">
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
              <span className="font-semibold text-gray-600">YOS:</span>
              <span className="text-gray-800">{worker.yos ?? "N/A"}</span>
            </div>
          </div>
        </div>
        <div className="bg-gray-50 p-3 flex justify-between rounded-b-lg">
          {
            isManager ? (
              <button
                onClick={() => onDelete(worker.uid)}
                className="px-4 py-2 bg-red-100 text-red-500 rounded-md hover:bg-red-200"
              >
                Remove
              </button>
            ) : (
              <div />
            ) /* Placeholder to maintain layout */
          }
          <div className="flex space-x-2">
            {isManager && (
              <button
                onClick={() => onEdit(worker)}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                Edit
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Close
            </button>
          </div>
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
  isSelected,
  onToggleSelect,
  isManager,
  currentUserId,
}) => {
  const getCellClass = (colKey) => {
    if (isSelected && isManager) return ""; // Selection highlight takes priority, disable hover highlight
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
        return "bg-green-200/80";
      case "Opening":
        return "bg-yellow-200/80";
      case "Closing":
        return "bg-purple-200/80";
      default:
        return "";
    }
  };

  const shouldShowShiftType = (shift, worker) => {
    if (!shift || !worker || !shift.type || !worker.title) return false;
    if (shift.type === "LESSONS") return true;
    if (shift.type === "CAMP") return true; // Always show for CAMP
    if (shift.type === "SWIM MEET") return true; // Always show for SWIM MEET
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

  const isCurrentUserWorker = currentUserId === worker.uid;

  return (
    <tr
      key={worker.uid}
      className={`${
        (isSelected && isManager) || (isCurrentUserWorker && !isManager)
          ? "bg-indigo-200"
          : "bg-white"
      }`}
    >
      {isManager && (
        <td
          className={`cell-padding border text-center cursor-pointer transition-colors duration-100 ${getCellClass(
            "name"
          )}`}
          onClick={() => onToggleSelect(worker.uid)}
          onMouseEnter={() => handleMouseEnter(worker.uid, "name")}
        >
          <input
            type="checkbox"
            className="rounded cursor-pointer"
            checked={isSelected}
            onChange={() => onToggleSelect(worker.uid)}
            onClick={(e) => e.stopPropagation()}
          />
        </td>
      )}
      <td
        className={`cell-padding !pl-1 border text-sm font-medium min-w-[150px] max-w-[180px] no-scrollbar overflow-auto transition-colors duration-100 cursor-pointer ${getCellClass(
          "name"
        )}`}
        onClick={() => onWorkerClick(worker)}
        onMouseEnter={() => handleMouseEnter(worker.uid, "name")}
      >
        {worker.fullName
          ? (() => {
              const parts = worker.fullName.trim().split(" ");
              if (parts.length > 1) {
                const first = parts[0];
                const last = parts.slice(1).join(" ");
                return `${last}, ${first}`;
              }
              return worker.fullName;
            })()
          : worker.email}
        {worker.isMinor && (
          <span className="text-gray-500 font-medium ml-1">(M)</span>
        )}
      </td>
      <td
        className={`cell-padding border text-center transition-colors duration-100 ${getCellClass(
          "yos"
        )}`}
        onMouseEnter={() => handleMouseEnter(worker.uid, "yos")}
      >
        {worker.yos ?? 0}
      </td>
      {["sun", "mon", "tue", "wed", "thu", "fri", "sat"].map((day) => {
        const dayShifts = weeklyShifts?.[day];
        const isRevealed = revealedHoursWorkerId === worker.uid;
        let dailyTotalHours = 0;
        if (isRevealed) {
          dailyTotalHours = calculateDailyHours(dayShifts, worker.isMinor);
        }

        return (
          <td
            key={day}
            className={`cell-padding border text-center transition-colors duration-100 ${
              isManager ? "cursor-pointer" : ""
            } ${getCellClass(day)}`}
            onMouseEnter={() => handleMouseEnter(worker.uid, day)}
            onClick={(e) => onCellClick(e, worker, day)}
          >
            {isRevealed ? (
              dailyTotalHours > 0 ? (
                <div className="font-semibold text-sm text-blue-600 h-full flex items-center justify-center">
                  {dailyTotalHours.toFixed(2)}
                </div>
              ) : (
                <span className="text-gray-400">0</span>
              )
            ) : Array.isArray(dayShifts) ? (
              dayShifts[0]?.type === "OFF" ? (
                <div className="text-xs text-red-500 h-full flex items-center justify-center">
                  OFF
                </div>
              ) : dayShifts[0]?.type === "SWIM MEET" ? (
                <div className="text-xs text-orange-400 h-full flex items-center justify-center">
                  SWIM MEET
                </div>
              ) : (
                <div>
                  {[...dayShifts]
                    .sort((a, b) =>
                      (a.start || "").localeCompare(b.start || "")
                    )
                    .map((shift, index) => (
                      <div
                        key={index}
                        className={`text-xs rounded-md p-0.5 flex items-center gap-1 justify-center text-nowrap ${getShiftHighlightClass(
                          shift
                        )}`}
                      >
                        <div>{`${formatTime12hr(
                          shift.start
                        )} - ${formatTime12hr(shift.end)}`}</div>
                        {shouldShowShiftType(shift, worker) && (
                          <div className="text-gray-500 text-xs">
                            {shift.type === "CAMP"
                              ? "(CAMP)"
                              : shift.type === "LESSONS"
                              ? "(L)"
                              : `(${shift.type[0]})`}
                          </div>
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
        className={`cell-padding border text-sm ${
          weeklyTotal > 40 && "text-red-500 bg-red-50 border-black"
        } text-center font-medium transition-colors duration-100 cursor-pointer ${getCellClass(
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

const FloatingPresetChip = ({ preset, position }) => {
  if (!preset) return null;

  // Helper to get the highlight class for the shift
  const getShiftHighlightClass = (shift) => {
    if (shift.role === "LESSONS") return "bg-white";
    const openingTime = "13:00";
    const closingTime = "18:00";
    const isOpening = shift.start <= openingTime;
    const isClosing = shift.end >= closingTime;
    if (isOpening && isClosing) return "bg-green-200";
    if (isOpening) return "bg-yellow-200";
    if (isClosing) return "bg-purple-200";
    return "bg-white";
  };

  const highlightClass = getShiftHighlightClass(preset);

  return (
    <div
      className={`fixed z-50 pointer-events-none text-xs font-medium px-2 py-1 rounded shadow-lg ${highlightClass}`}
      style={{ top: position.y + 10, left: position.x + 10 }}
    >
      {`${formatTime12hr(preset.start).replace(/:00$/, "")}-${formatTime12hr(
        preset.end
      ).replace(/:00$/, "")}`}
    </div>
  );
};

const EasyAddToolbar = ({ presets, onPresetSelect, activePreset, onClear }) => {
  const [selectedRole, setSelectedRole] = useState("GUARD");
  const applicablePresets = presets.filter((p) =>
    p.applicableTo.includes(selectedRole)
  );

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-auto bg-gray-500 text-white p-2 rounded-t-lg shadow border border-b-0 flex items-center gap-2 z-40">
      <select
        value={selectedRole}
        onChange={(e) => setSelectedRole(e.target.value)}
        className="bg-gray-600 border-none rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500"
      >
        <option>GUARD</option>
        <option>MANAGER</option>
        <option>FRONT</option>
        <option>LESSONS</option>
        <option>CAMP</option>
      </select>
      <div className="flex items-center gap-1">
        {applicablePresets.map((p) => (
          <button
            key={p.id}
            onClick={() => onPresetSelect(p, selectedRole)}
            className={`text-xs px-2 py-1 rounded ${
              activePreset?.id === p.id
                ? "bg-blue-500 ring-2 ring-blue-300 text-white"
                : "bg-gray-600 hover:bg-gray-700"
            }`}
          >
            {`${formatTime12hr(p.start).replace(/:00$/, "")}-${formatTime12hr(
              p.end
            ).replace(/:00$/, "")}`}
          </button>
        ))}
      </div>
      {activePreset && (
        <button
          onClick={onClear}
          className="bg-red-500 hover:bg-red-600 text-white font-medium pl-1 pr-2 py-1 rounded flex items-center justify-center gap-1"
        >
          <X size={14} />
          <span className="text-xs">Esc</span>
        </button>
      )}
    </div>
  );
};

const ScheduleView = ({
  company,
  workers,
  presets,
  isManager = true,
  currentUserId,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [editingWorker, setEditingWorker] = useState(null);
  const [hoveredCell, setHoveredCell] = useState({ row: null, col: null });
  const [popoverTarget, setPopoverTarget] = useState(null);
  const [revealedHoursWorkerId, setRevealedHoursWorkerId] = useState(null);
  const [selectedWorkers, setSelectedWorkers] = useState([]);
  const [activePreset, setActivePreset] = useState(null);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const tableRef = useRef(null);

  const [scheduleDocData, setScheduleDocData] = useState(null);
  const [history, setHistory] = useState([{}]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const scheduleData = useMemo(
    () => history[historyIndex] || {},
    [history, historyIndex]
  );

  const isLocalUpdateRef = useRef(false);

  useEffect(() => {
    if (!isManager) return;
    const handleMouseMove = (e) => {
      setCursorPos({ x: e.clientX, y: e.clientY });
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setActivePreset(null);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isManager]);

  const weekStartDate = useMemo(
    () => getSundayOfWeek(currentDate),
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
      if ((b.yos || 0) !== (a.yos || 0)) return (b.yos || 0) - (a.yos || 0);

      // Sort by last name (first letter of second word in fullName)
      const getLastNameFirstLetter = (worker) => {
        if (!worker.fullName) return "";
        const parts = worker.fullName.trim().split(" ");
        return parts.length > 1 ? parts[1][0].toLowerCase() : "";
      };
      const lastA = getLastNameFirstLetter(a);
      const lastB = getLastNameFirstLetter(b);
      if (lastA < lastB) return -1;
      if (lastA > lastB) return 1;
      return 0;
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
    const dayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

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
    const year = weekStartDate.getFullYear();
    const month = String(weekStartDate.getMonth() + 1).padStart(2, "0");
    const day = String(weekStartDate.getDate()).padStart(2, "0");
    const weekId = `${year}-${month}-${day}`;
    return `${company.id}_${weekId}`;
  }, [company, weekStartDate]);

  useEffect(() => {
    if (!scheduleDocId) return;

    const scheduleDocRef = doc(db, "schedules", scheduleDocId);
    const unsubscribe = onSnapshot(scheduleDocRef, (docSnap) => {
      const docData = docSnap.data() || {};
      setScheduleDocData(docData);

      if (isLocalUpdateRef.current && isManager) {
        isLocalUpdateRef.current = false;
        setLoading(false);
        return;
      }

      const shiftsForView = isManager
        ? docData.shifts || {}
        : docData.isPublished
        ? docData.publishedShifts || {}
        : {};

      if (deepEqual(shiftsForView, history[historyIndex])) {
        setLoading(false);
        return;
      }

      const updatedShifts = { ...shiftsForView };
      let needsUpdate = false;
      if (isManager) {
        workers.forEach((worker) => {
          if (worker.uid && !updatedShifts[worker.uid]) {
            updatedShifts[worker.uid] = {};
            needsUpdate = true;
          }
        });
      }

      if (needsUpdate) {
        setDoc(
          scheduleDocRef,
          {
            companyId: company.id,
            weekOf: weekStartDate,
            isPublished: docData.isPublished || false,
            shifts: updatedShifts,
          },
          { merge: true }
        );
      }
      setHistory([updatedShifts]);
      setHistoryIndex(0);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [scheduleDocId, isManager, workers, company, weekStartDate]);

  const isPublished = scheduleDocData?.isPublished || false;

  const hasUnpublishedChanges = useMemo(() => {
    if (!isManager || !isPublished || !scheduleDocData) {
      return false;
    }
    return !deepEqual(scheduleData, scheduleDocData.publishedShifts);
  }, [isManager, isPublished, scheduleData, scheduleDocData]);

  const pushNewState = (newShifts) => {
    const newHistory = history.slice(0, historyIndex + 1);
    setHistory([...newHistory, newShifts]);
    setHistoryIndex(newHistory.length);
  };

  const handleToggleSelectWorker = (workerId) => {
    setSelectedWorkers((prev) =>
      prev.includes(workerId)
        ? prev.filter((id) => id !== workerId)
        : [...prev, workerId]
    );
  };

  const handleToggleSelectAll = (e, workerList) => {
    const workerIds = workerList.map((w) => w.uid);
    if (e.target.checked) {
      setSelectedWorkers((prev) => [...new Set([...prev, ...workerIds])]);
    } else {
      setSelectedWorkers((prev) =>
        prev.filter((id) => !workerIds.includes(id))
      );
    }
  };

  const handleBulkUpdate = async (updateValue) => {
    if (selectedWorkers.length === 0 || !scheduleDocId || !isManager) return;

    isLocalUpdateRef.current = true;
    const newScheduleData = JSON.parse(JSON.stringify(scheduleData));
    const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    selectedWorkers.forEach((workerId) => {
      days.forEach((day) => {
        if (!newScheduleData[workerId]) newScheduleData[workerId] = {};
        newScheduleData[workerId][day] = updateValue;
      });
    });

    pushNewState(newScheduleData);
    const scheduleDocRef = doc(db, "schedules", scheduleDocId);
    await setDoc(scheduleDocRef, { shifts: newScheduleData }, { merge: true });
    setSelectedWorkers([]);
  };

  const handleBulkRemove = async () => {
    if (selectedWorkers.length === 0 || !isManager) return;
    if (
      window.confirm(
        `Are you sure you want to remove ${selectedWorkers.length} worker(s)? This is permanent.`
      )
    ) {
      const batch = writeBatch(db);
      selectedWorkers.forEach((workerId) => {
        batch.delete(doc(db, "users", workerId));
      });
      await batch.commit();
      setSelectedWorkers([]);
    }
  };

  const handleSaveShift = async (
    worker,
    day,
    newShiftData,
    mode = "append"
  ) => {
    if (!scheduleDocId || !isManager) return;
    isLocalUpdateRef.current = true;
    const newScheduleData = JSON.parse(JSON.stringify(scheduleData));
    if (!newScheduleData[worker.uid]) newScheduleData[worker.uid] = {};

    if (mode === "replace") {
      newScheduleData[worker.uid][day] = newShiftData;
    } else {
      const currentShifts = newScheduleData[worker.uid][day] || [];
      const filteredShifts = Array.isArray(currentShifts)
        ? currentShifts.filter((s) => s.type !== "OFF")
        : [];
      const newShiftsToAdd = Array.isArray(newShiftData)
        ? newShiftData
        : [newShiftData];
      newScheduleData[worker.uid][day] = [...filteredShifts, ...newShiftsToAdd];
    }

    pushNewState(newScheduleData);
    const scheduleDocRef = doc(db, "schedules", scheduleDocId);
    await setDoc(scheduleDocRef, { shifts: newScheduleData }, { merge: true });
    handleClosePopover();
  };

  const handleCellClick = (event, worker, day) => {
    if (!isManager) return;
    event.stopPropagation();
    if (activePreset) {
      let defaultType = "GUARD";
      const title = worker.title.toLowerCase();
      if (title.includes("manager") || title.includes("head guard"))
        defaultType = "MANAGER";
      else if (title.includes("front")) defaultType = "FRONT";

      const newShift = {
        start: activePreset.start,
        end: activePreset.end,
        type: activePreset.role || defaultType,
      };
      handleSaveShift(worker, day, [newShift], "append");
    } else {
      const currentShift = scheduleData[worker.uid]?.[day] || null;
      setPopoverTarget({
        worker,
        day,
        initialShift: currentShift,
        rect: event.currentTarget.getBoundingClientRect(),
      });
      setHoveredCell({ row: worker.uid, col: day });
    }
  };

  const handleClosePopover = () => {
    setPopoverTarget(null);
    setHoveredCell({ row: null, col: null });
  };

  const handleSaveFromPopover = (newShiftData) => {
    if (!popoverTarget) return;
    const { worker, day } = popoverTarget;
    handleSaveShift(worker, day, newShiftData, "replace");
  };

  const handleWeekChange = (weeks) => {
    setCurrentDate((prevDate) => {
      const newDate = new Date(prevDate);
      newDate.setDate(newDate.getDate() + weeks * 7);
      return newDate;
    });
  };

  const handleOpenEditModal = (worker) => {
    if (!isManager) return;
    setEditingWorker(worker);
    setSelectedWorker(null);
  };

  const handleDeleteWorker = async (workerId) => {
    if (!isManager) return;
    if (
      window.confirm(
        "Are you sure you want to remove this worker? This action cannot be undone."
      )
    ) {
      try {
        await deleteDoc(doc(db, "users", workerId));
        setSelectedWorker(null);
      } catch (error) {
        console.error("Error removing worker: ", error);
        alert("Failed to remove worker.");
      }
    }
  };

  const handleHeaderMouseEnter = (colId) => {
    if (!popoverTarget) setHoveredCell({ row: null, col: colId });
  };

  const handleUndo = async () => {
    if (!isManager || historyIndex <= 0) return;
    isLocalUpdateRef.current = true;
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    const prevState = history[newIndex];
    const scheduleDocRef = doc(db, "schedules", scheduleDocId);
    await setDoc(scheduleDocRef, { shifts: prevState }, { merge: true });
  };

  const handleRedo = async () => {
    if (!isManager || historyIndex >= history.length - 1) return;
    isLocalUpdateRef.current = true;
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    const nextState = history[newIndex];
    const scheduleDocRef = doc(db, "schedules", scheduleDocId);
    await setDoc(scheduleDocRef, { shifts: nextState }, { merge: true });
  };

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    if (!isManager) return;
    const handleKeyDown = (e) => {
      // Ctrl+Z (undo)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "z") {
        e.preventDefault();
        handleUndo();
      }
      // Ctrl+Shift+Z (redo on Mac) or Ctrl+Y (redo on Windows)
      if (
        ((e.ctrlKey || e.metaKey) &&
          e.shiftKey &&
          e.key.toLowerCase() === "z") ||
        ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "y")
      ) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line
  }, [isManager, historyIndex, history, scheduleDocId]);

  const handlePublish = async () => {
    if (!isManager || !scheduleDocId) return;
    const scheduleDocRef = doc(db, "schedules", scheduleDocId);
    const updateData = {
      isPublished: true,
      publishedShifts: scheduleData,
    };
    await updateDoc(scheduleDocRef, updateData);
    setScheduleDocData((prev) => ({ ...prev, ...updateData }));
  };

  const handleUnpublish = async () => {
    if (!isManager || !scheduleDocId) return;
    if (
      !window.confirm(
        "Are you sure? Unpublishing will hide the schedule from all workers."
      )
    )
      return;
    const scheduleDocRef = doc(db, "schedules", scheduleDocId);
    await updateDoc(scheduleDocRef, { isPublished: false });
    setScheduleDocData((prev) => ({ ...prev, isPublished: false }));
  };

  const handlePublishChanges = async () => {
    if (!isManager || !scheduleDocId) return;
    const scheduleDocRef = doc(db, "schedules", scheduleDocId);
    const updateData = { publishedShifts: scheduleData };
    await updateDoc(scheduleDocRef, updateData);
    setScheduleDocData((prev) => ({ ...prev, ...updateData }));
  };

  const handleRevealHoursStart = (workerId) => {
    if (tableRef.current) {
      const headerCells = tableRef.current.querySelectorAll("thead th");
      headerCells.forEach((th) => {
        const rect = th.getBoundingClientRect();
        th.style.width = `${rect.width}px`;
      });
    }
    setRevealedHoursWorkerId(workerId);
  };

  const handleRevealHoursEnd = () => {
    if (tableRef.current) {
      const headerCells = tableRef.current.querySelectorAll("thead th");
      headerCells.forEach((th) => {
        th.style.width = "";
      });
    }
    setRevealedHoursWorkerId(null);
  };

  const renderWeekHeader = (forPrint = false) => {
    const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const displayDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const headerDates = [];
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(weekStartDate);
      dayDate.setDate(dayDate.getDate() + i);
      headerDates.push(
        `${displayDays[i]} ${dayDate.getMonth() + 1}/${dayDate.getDate()}`
      );
    }

    if (forPrint) {
      return `
        <tr style="background-color: #f3f4f6;">
          <th style="padding: 3px; border: 1px solid #e5e7eb; text-align: left; font-weight: 600; color: #4b5563; min-width: 150px;">Worker</th>
          <th style="padding: 3px; border: 1px solid #e5e7eb;; font-weight: 600; color: #4b5563;">YOS</th>
          ${days
            .map(
              (dayKey, i) => `
            <th style="padding: 3px; border: 1px solid #e5e7eb; text-align: center; font-weight: 600; color: #4b5563;">
              <div>${headerDates[i]}</div>
              <div style="display: flex; justify-content: center; align-items: center; gap: 12px; margin-top: 2px;">
                <span >
                ${dailyStaffCounts[dayKey]?.GUARD || "0"} G
                </span>
                <span >
                ${dailyStaffCounts[dayKey]?.FRONT || "0"} F
                </span>
              </div>
            </th>
          `
            )
            .join("")}
          <th style="padding: 3px; border: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">Hours</th>
        </tr>
      `;
    }

    return (
      <tr className="bg-gray-100">
        {isManager && (
          <th className="header-cell-padding border text-center">
            <input
              type="checkbox"
              className="rounded"
              onChange={(e) =>
                handleToggleSelectAll(e, [
                  ...sortedManagersAndGuards,
                  ...sortedFrontWorkers,
                ])
              }
              checked={
                workers.length > 0 && selectedWorkers.length === workers.length
              }
            />
          </th>
        )}
        <th
          className={`header-cell-padding border text-left text-xs font-semibold text-gray-600 min-w-[150px] max-w-[250px] bg-gray-100`}
          onMouseEnter={() => handleHeaderMouseEnter("name")}
        >
          Worker
        </th>
        <th
          className={`header-cell-padding border text-xs font-semibold text-gray-600 transition-colors duration-100 ${
            hoveredCell.col === "yos" ? "bg-blue-100" : "bg-gray-100"
          }`}
          onMouseEnter={() => handleHeaderMouseEnter("yos")}
        >
          YOS
        </th>
        {days.map((dayKey, i) => (
          <th
            key={dayKey}
            className={`header-cell-padding border text-xs font-semibold text-gray-600 transition-colors duration-100 ${
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
          className={`header-cell-padding border text-xs font-semibold text-gray-600 transition-colors duration-100 ${
            hoveredCell.col === "total" ? "bg-blue-100" : "bg-gray-100"
          }`}
          onMouseEnter={() => handleHeaderMouseEnter("total")}
        >
          Hours
        </th>
      </tr>
    );
  };

  const renderWorkerRowForPrint = (worker) => {
    const weeklyShifts = scheduleData[worker.uid];
    const weeklyTotal = weeklyShifts
      ? Object.values(weeklyShifts).reduce(
          (total, dayShifts) =>
            total + calculateDailyHours(dayShifts, worker.isMinor),
          0
        )
      : 0;

    const shouldShowShiftType = (shift, worker) => {
      if (!shift || !worker || !shift.type || !worker.title) return false;
      if (shift.type === "LESSONS") return true;
      if (shift.type === "CAMP") return true;
      if (worker.title.includes("Lifeguard") && shift.type === "GUARD")
        return false;
      if (worker.title.includes("Front") && shift.type === "FRONT")
        return false;
      return true;
    };

    return `
            <tr>
                <td style="padding: 2px; padding-left: 3px; border: 1px solid #e5e7eb; font-weight: 500; text-align: left;">
                    ${worker.fullName || worker.email}
                    ${
                      worker.isMinor
                        ? '<span style="color: #6b7280; font-weight: 500; margin-left: 4px;">(M)</span>'
                        : ""
                    }
                    
                </td>
                <td style="padding: 2px; border: 1px solid #e5e7eb; text-align: center;">${
                  worker.yos ?? 0
                }</td>
                ${["sun", "mon", "tue", "wed", "thu", "fri", "sat"]
                  .map((day) => {
                    const dayShifts = weeklyShifts?.[day];
                    let cellContent = '<span style="color: #9ca3af;">-</span>';
                    if (Array.isArray(dayShifts)) {
                      if (dayShifts[0]?.type === "OFF") {
                        cellContent = '<div style="color: #ef4444;">OFF</div>';
                      } else if (dayShifts[0]?.type === "SWIM MEET") {
                        cellContent =
                          '<div style="color: #ff8904;">SWIM MEET</div>';
                      } else {
                        cellContent = dayShifts
                          .map(
                            (shift) => `
                                <div style="font-size: 10px;">
                                    ${formatTime12hr(
                                      shift.start
                                    )} - ${formatTime12hr(shift.end)}
                                    ${
                                      shouldShowShiftType(shift, worker)
                                        ? `<span style="color: #6b7280;"> (${
                                            shift.type === "CAMP"
                                              ? "CAMP"
                                              : shift.type === "LESSONS"
                                              ? "L"
                                              : shift.type[0]
                                          })</span>`
                                        : ""
                                    }
                                </div>
                            `
                          )
                          .join("");
                      }
                    }
                    return `<td style="padding: 2px; border: 1px solid #e5e7eb; text-align: center;">${cellContent}</td>`;
                  })
                  .join("")}
                <td style="padding: 2px; border: 1px solid #e5e7eb; text-align: center; font-weight: 500;">${weeklyTotal.toFixed(
                  2
                )}</td>
            </tr>
        `;
  };

  const handlePrint = () => {
    const weekEndDateForPrint = new Date(weekStartDate);
    weekEndDateForPrint.setDate(weekStartDate.getDate() + 6);

    const printWindow = window.open("", "_blank", "height=600,width=800");
    let htmlContent = `
      <html>
      <head>
        <title>Print Schedule</title>
        <style>
        @media print {
          @page { size: landscape; }
        }
        body { font-family: sans-serif; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 6px; text-align: center; font-size: 10px; }
        th { background-color: #f2f2f2; }
        h1, h2 { text-align: center; }
        .section-header { 
          font-size: 10px; 
          color: #6b7280;
          font-weight: bold; 
          padding: 3px; 
          background-color: #f3f4f6; 
          border-bottom: 1px solid #e5e7eb;
          text-align: left;
        }
        </style>
      </head>
      <body>
        <p style="text-align:center; font-weight: bold; margin: 0; margin-bottom: 4px">Schedule for ${formatWeekRange(
          weekStartDate,
          weekEndDateForPrint
        )}</p>
        <table>
        <thead>
          ${renderWeekHeader(true)}
        </thead>
        <tbody>
          ${sortedManagersAndGuards
            .map((worker) => renderWorkerRowForPrint(worker))
            .join("")}
        </tbody>
        ${
          sortedFrontWorkers.length > 0
            ? `
          <tbody>
          <tr><td colspan="10" class="section-header">Front Workers</td></tr>
          </tbody>
          <tbody>
          ${sortedFrontWorkers
            .map((worker) => renderWorkerRowForPrint(worker))
            .join("")}
          </tbody>
        `
            : ""
        }
        </table>
      </body>
      </html>
    `;
    printWindow.document.open();
    printWindow.document.close();
    printWindow.document.body.innerHTML = htmlContent;
    printWindow.focus();
    // Use a timeout to ensure content is loaded before printing
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekStartDate.getDate() + 6);

  const formatWeekRange = (start, end) => {
    const startMonth = start.toLocaleString("default", { month: "long" });
    const endMonth = end.toLocaleString("default", { month: "long" });
    const startDay = start.getDate();
    const endDay = end.getDate();

    if (startMonth === endMonth) {
      return `${startMonth} ${startDay}-${endDay}`;
    } else {
      return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
    }
  };

  const isCurrentWeek = useMemo(() => {
    const today = getSundayOfWeek(new Date());
    return (
      weekStartDate.getFullYear() === today.getFullYear() &&
      weekStartDate.getMonth() === today.getMonth() &&
      weekStartDate.getDate() === today.getDate()
    );
  }, [weekStartDate]);

  const handleGoToCurrentWeek = () => {
    setCurrentDate(new Date());
  };

  // --- START: Dual Scrollbar Logic ---
  const mainContentRef = useRef(null);
  const topScrollbarRef = useRef(null);
  const isSyncingRef = useRef(false);
  const [showTopScrollbar, setShowTopScrollbar] = useState(false);

  useEffect(() => {
    const mainContentEl = mainContentRef.current;
    const topScrollbarEl = topScrollbarRef.current;

    if (!mainContentEl || !topScrollbarEl || loading) return;

    const topScrollbarContent = topScrollbarEl.querySelector("div");

    const checkOverflow = () => {
      if (mainContentEl.scrollWidth > mainContentEl.clientWidth) {
        setShowTopScrollbar(true);
      } else {
        setShowTopScrollbar(false);
      }
      if (topScrollbarContent) {
        topScrollbarContent.style.width = `${mainContentEl.scrollWidth}px`;
      }
    };

    checkOverflow();

    const handleMainScroll = () => {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;
      topScrollbarEl.scrollLeft = mainContentEl.scrollLeft;
      isSyncingRef.current = false;
    };

    const handleTopScroll = () => {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;
      mainContentEl.scrollLeft = topScrollbarEl.scrollLeft;
      isSyncingRef.current = false;
    };

    mainContentEl.addEventListener("scroll", handleMainScroll);
    topScrollbarEl.addEventListener("scroll", handleTopScroll);

    const resizeObserver = new ResizeObserver(checkOverflow);
    resizeObserver.observe(mainContentEl);

    return () => {
      mainContentEl.removeEventListener("scroll", handleMainScroll);
      topScrollbarEl.removeEventListener("scroll", handleTopScroll);
      resizeObserver.unobserve(mainContentEl);
    };
  }, [scheduleData, workers, loading]); // Rerun when data or loading state changes
  // --- END: Dual Scrollbar Logic ---

  return (
    <div className="pb-24">
      {isManager && (
        <FloatingPresetChip preset={activePreset} position={cursorPos} />
      )}
      <WorkerDetailModal
        worker={selectedWorker}
        onClose={() => setSelectedWorker(null)}
        onEdit={handleOpenEditModal}
        onDelete={handleDeleteWorker}
        isManager={isManager}
      />
      {isManager && (
        <EditWorkerModal
          worker={editingWorker}
          isOpen={!!editingWorker}
          onClose={() => setEditingWorker(null)}
        />
      )}
      {popoverTarget && isManager && (
        <ShiftEditPopover
          targetCell={popoverTarget}
          presets={presets}
          onSave={handleSaveFromPopover}
          onClose={handleClosePopover}
        />
      )}

      {/* Date & Arrows */}
      <div className="max-w-6xl mx-auto flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleWeekChange(-1)}
            className="h-9 w-9 flex items-center justify-center bg-gray-200 rounded-full hover:bg-gray-300"
          >
            <ChevronLeft width={19} />
          </button>

          <button
            className={`h-9 w-9 flex items-center justify-center gap-2 text-blue-500 bg-blue-100 rounded-full ${
              (isCurrentWeek || weekStartDate < getSundayOfWeek(new Date())) &&
              "opacity-0 !cursor-default"
            }`}
            onClick={handleGoToCurrentWeek}
          >
            <ChevronsLeft width={19} />
          </button>
        </div>

        <h3 className="text-2xl font-medium text-center">
          {formatWeekRange(weekStartDate, weekEndDate)}
        </h3>

        <div className="flex items-center gap-2">
          <button
            className={`h-9 w-9 flex items-center justify-center gap-2 text-blue-500 bg-blue-100 rounded-full ${
              (isCurrentWeek || weekStartDate > getSundayOfWeek(new Date())) &&
              "opacity-0 !cursor-default"
            }`}
            onClick={handleGoToCurrentWeek}
          >
            <ChevronsRight width={19} />
          </button>

          <button
            onClick={() => handleWeekChange(1)}
            className="h-9 w-9 flex items-center justify-center bg-gray-200 rounded-full hover:bg-gray-300"
          >
            <ChevronRight width={19} />
          </button>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {isManager && (
        <BulkActionsBar
          selectedWorkers={selectedWorkers}
          handleBulkUpdate={handleBulkUpdate}
          handleBulkRemove={handleBulkRemove}
          handleUndo={handleUndo}
          handleRedo={handleRedo}
          canUndo={historyIndex > 0}
          canRedo={historyIndex < history.length - 1}
          onPrint={handlePrint}
          isPublished={isPublished}
          hasUnpublishedChanges={hasUnpublishedChanges}
          onPublish={handlePublish}
          onUnpublish={handleUnpublish}
          onPublishChanges={handlePublishChanges}
        />
      )}

      {/* No Schedule Published Message */}
      {!isManager && !loading && !isPublished && (
        <div className="text-center p-8 bg-gray-50 rounded-lg">
          <p className="text-gray-600">
            The schedule for this week has not been published yet.
          </p>
        </div>
      )}

      {/* Top Scrollbar */}
      <div
        ref={topScrollbarRef}
        className="overflow-x-auto overflow-y-hidden transition-all duration-300"
        style={{
          height: showTopScrollbar ? "15px" : "0",
          visibility: showTopScrollbar ? "visible" : "hidden",
        }}
      >
        <div style={{ height: "1px" }}></div>
      </div>

      {/* Schedule Table */}
      {((isManager && !loading) || (!isManager && isPublished)) && (
        <div className="overflow-x-auto" ref={mainContentRef}>
          <table
            ref={tableRef}
            className="w-full border-collapse border"
            onMouseLeave={() => {
              if (!popoverTarget) setHoveredCell({ row: null, col: null });
            }}
          >
            <thead>{renderWeekHeader()}</thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="text-center p-4">
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
                    onCellClick={isManager ? handleCellClick : () => {}}
                    revealedHoursWorkerId={revealedHoursWorkerId}
                    onRevealHoursStart={handleRevealHoursStart}
                    onRevealHoursEnd={handleRevealHoursEnd}
                    isSelected={selectedWorkers.includes(worker.uid)}
                    onToggleSelect={handleToggleSelectWorker}
                    isManager={isManager}
                    currentUserId={currentUserId}
                  />
                ))
              )}
            </tbody>
            {sortedFrontWorkers.length > 0 && (
              <>
                <tbody>
                  <tr className="bg-gray-100 text-center">
                    {isManager && (
                      <td className="p-2">
                        <input
                          type="checkbox"
                          className="rounded"
                          onChange={(e) =>
                            handleToggleSelectAll(e, sortedFrontWorkers)
                          }
                          checked={
                            sortedFrontWorkers.length > 0 &&
                            sortedFrontWorkers.every((fw) =>
                              selectedWorkers.includes(fw.uid)
                            )
                          }
                        />
                      </td>
                    )}
                    <td
                      colSpan={isManager ? 10 : 9}
                      className={`p-2 border text-left text-xs font-semibold text-gray-600`}
                    >
                      Front Workers
                    </td>
                  </tr>
                </tbody>
                <tbody>
                  {sortedFrontWorkers.map((worker) => (
                    <WorkerRow
                      key={worker.uid}
                      worker={worker}
                      scheduleData={scheduleData}
                      onWorkerClick={isManager ? setSelectedWorker : () => {}}
                      hoveredCell={hoveredCell}
                      popoverTarget={popoverTarget}
                      onCellEnter={setHoveredCell}
                      onCellClick={isManager ? handleCellClick : () => {}}
                      revealedHoursWorkerId={revealedHoursWorkerId}
                      onRevealHoursStart={handleRevealHoursStart}
                      onRevealHoursEnd={handleRevealHoursEnd}
                      isSelected={selectedWorkers.includes(worker.uid)}
                      onToggleSelect={handleToggleSelectWorker}
                      isManager={isManager}
                      currentUserId={currentUserId}
                    />
                  ))}
                </tbody>
              </>
            )}
          </table>
        </div>
      )}

      {/* Floating Easy Add Toolbar */}
      {isManager && (
        <EasyAddToolbar
          presets={presets}
          activePreset={activePreset}
          onPresetSelect={(preset, role) =>
            setActivePreset({ ...preset, role })
          }
          onClear={() => setActivePreset(null)}
        />
      )}
    </div>
  );
};

// --- BulkActionsBar component ---
const BulkActionsBar = ({
  selectedWorkers,
  handleBulkUpdate,
  handleBulkRemove,
  handleUndo,
  handleRedo,
  canUndo,
  canRedo,
  onPrint,
  isPublished,
  hasUnpublishedChanges,
  onPublish,
  onUnpublish,
  onPublishChanges,
}) => {
  const [showMenu, setShowMenu] = React.useState(false);
  const menuRef = React.useRef(null);

  React.useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showMenu]);

  // Tooltip state for Undo/Redo
  const [undoTooltip, setUndoTooltip] = React.useState(false);
  const [redoTooltip, setRedoTooltip] = React.useState(false);
  const undoTimeout = React.useRef();
  const redoTimeout = React.useRef();

  // Tooltip handlers
  const handleUndoMouseEnter = () => {
    undoTimeout.current = setTimeout(() => setUndoTooltip(true), 600);
  };
  const handleUndoMouseLeave = () => {
    clearTimeout(undoTimeout.current);
    setUndoTooltip(false);
  };
  const handleRedoMouseEnter = () => {
    redoTimeout.current = setTimeout(() => setRedoTooltip(true), 600);
  };
  const handleRedoMouseLeave = () => {
    clearTimeout(redoTimeout.current);
    setRedoTooltip(false);
  };

  return (
    <div
      className={`rounded-tl-lg border-t border-x rounded-tr-lg p-2 flex items-center justify-between bg-gray-500`}
    >
      <div className="flex-1">
        {selectedWorkers.length > 0 ? (
          <span className={`ml-1 text-white`}>
            {selectedWorkers.length} worker(s) selected
          </span>
        ) : (
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={handleUndo}
                disabled={!canUndo}
                className={`flex items-center justify-center gap-1 px-2 h-7 text-sm rounded-md bg-white disabled:opacity-50 ${
                  canUndo ? "hover:bg-gray-100" : "!cursor-default"
                }`}
                onMouseEnter={handleUndoMouseEnter}
                onMouseLeave={handleUndoMouseLeave}
              >
                <Undo2 width={15} /> Undo
              </button>
              {undoTooltip && (
                <div className="absolute left-1/2 -translate-x-1/2 -top-8 bg-gray-800 text-white text-xs rounded px-2 py-1 z-50 whitespace-nowrap pointer-events-none">
                  Ctrl+Z
                </div>
              )}
            </div>
            <div className="relative">
              <button
                onClick={handleRedo}
                disabled={!canRedo}
                className={`flex items-center justify-center gap-1 px-2 h-7 text-sm rounded-md bg-white disabled:opacity-50 ${
                  canRedo ? "hover:bg-gray-100" : "!cursor-default"
                }`}
                onMouseEnter={handleRedoMouseEnter}
                onMouseLeave={handleRedoMouseLeave}
              >
                Redo <Redo2 width={15} />
              </button>
              {redoTooltip && (
                <div className="absolute left-1/2 -translate-x-1/2 -top-8 bg-gray-800 text-white text-xs rounded px-2 py-1 z-50 whitespace-nowrap pointer-events-none">
                  Ctrl+Shift+Z
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 relative">
        {selectedWorkers.length > 0 ? (
          <>
            <button
              onClick={() => handleBulkUpdate([{ type: "OFF" }])}
              className="px-3 h-7 text-sm rounded-md bg-white text-red-500 hover:bg-red-100"
            >
              Set as OFF
            </button>
            <button
              onClick={() => handleBulkUpdate([{ type: "SWIM MEET" }])}
              className="px-3 h-7 text-sm rounded-md bg-white text-orange-600 hover:bg-orange-100"
            >
              Set as SWIM MEET
            </button>
            <button
              onClick={() => handleBulkUpdate(null)}
              className="px-3 h-7 text-sm rounded-md bg-white hover:bg-gray-100"
            >
              Reset Shifts
            </button>
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMenu((v) => !v)}
                className="w-7 h-7 flex items-center justify-center rounded-md bg-white hover:bg-gray-100"
              >
                <Ellipsis width={16} />
              </button>
              {showMenu && (
                <div className="absolute right-0 mt-2 w-min bg-white border rounded shadow-lg z-50">
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      handleBulkRemove();
                    }}
                    className="block w-full rounded-sm text-nowrap text-sm text-left p-2 text-red-600 hover:bg-red-50"
                  >
                    Remove worker(s)
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <button
              onClick={onPrint}
              className="flex items-center justify-center gap-1 px-2 h-7 text-sm rounded-md bg-white"
            >
              <Printer width={15} /> Print
            </button>
            {!isPublished ? (
              <button
                onClick={onPublish}
                className="flex items-center justify-center gap-1 px-2 h-7 text-sm rounded-md bg-green-600 text-white hover:bg-green-700"
              >
                <Send width={15} /> Publish
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={onPublishChanges}
                  disabled={!hasUnpublishedChanges}
                  className={`flex items-center justify-center gap-1 px-2 h-7 text-sm rounded-md bg-blue-500 text-white  disabled:opacity-50 disabled:!cursor-default ${
                    hasUnpublishedChanges ? "hover:bg-blue-600" : ""
                  }`}
                >
                  <CloudUpload width={15} /> Publish Changes
                </button>
                <button
                  onClick={onUnpublish}
                  className="flex items-center justify-center gap-1 px-2 h-7 text-sm rounded-md bg-gray-600 text-white hover:bg-gray-700"
                >
                  <EyeOff width={15} /> Unpublish
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ScheduleView;
