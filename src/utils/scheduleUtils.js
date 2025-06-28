// src/utils/scheduleUtils.js

// --- Deep object comparison helper ---
export function deepEqual(objA, objB) {
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
export const formatTime12hr = (time24) => {
  if (!time24) return "";
  const [hours, minutes] = time24.split(":");
  const h = parseInt(hours, 10);
  const newHours = h % 12 === 0 ? 12 : h % 12;
  if (minutes === "00") {
    return `${newHours}`;
  }
  return `${newHours}:${minutes}`;
};

export const calculateDailyHours = (dayShifts, isMinor) => {
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
export const getShiftCategory = (shift) => {
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

// --- Helper to get the start of a week (Sunday) for any given date ---
export const getSundayOfWeek = (d) => {
  const date = new Date(d);
  const day = date.getDay(); // Sunday - Saturday : 0 - 6
  const diff = date.getDate() - day;
  return new Date(date.setDate(diff));
};

// --- Format hours helper ---
export const formatHours = (num) => {
  if (num % 1 === 0) return num.toString();
  if ((num * 10) % 1 === 0) return num.toFixed(1);
  return num.toFixed(2).replace(/\.?0+$/, "");
};

// --- Helper to check if shift type should be shown ---
export const shouldShowShiftType = (shift, worker) => {
  if (!shift || !worker || !shift.type || !worker.title) return false;
  if (shift.type === "LESSONS") return true;
  if (shift.type === "CAMP") return true; // Always show for CAMP
  if (shift.type === "SWIM MEET") return true; // Always show for SWIM MEET
  if (worker.title.includes("Lifeguard") && shift.type === "GUARD")
    return false;
  if (worker.title.includes("Front") && shift.type === "FRONT") return false;
  return true;
};

// --- Helper to get shift highlight class ---
export const getShiftHighlightClass = (shift) => {
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

// --- Define column widths for the table ---
export const columnWidths = {
  checkbox: "25px",
  workerName: "150px",
  yos: "35px",
  day: "100px",
  total: "50px",
};
