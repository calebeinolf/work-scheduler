// src/components/FloatingPresetChip.jsx

import React from "react";
import { formatTime12hr, getShiftCategory } from "../utils/scheduleUtils";

const FloatingPresetChip = ({ preset, position }) => {
  if (!preset) return null;

  // Special handling for reset mode
  if (preset.isReset) {
    return (
      <div
        className="fixed z-50 pointer-events-none text-xs font-medium px-4 py-1 rounded shadow-lg bg-gray-200 text-gray-800"
        style={{ top: position.y + 10, left: position.x + 10 }}
      >
        -
      </div>
    );
  }

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

export default FloatingPresetChip;
