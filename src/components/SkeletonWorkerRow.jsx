// src/components/SkeletonWorkerRow.jsx

import React from "react";
import { columnWidths } from "../utils/scheduleUtils";

const SkeletonWorkerRow = ({ isManager, showCheckbox = true, index = 0 }) => {
  const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

  // Create some variation in skeleton widths to make it look more realistic
  const getNameWidth = () => {
    const widths = ["max-w-24", "max-w-32", "max-w-28", "max-w-36"];
    return widths[index % widths.length];
  };

  const getShiftWidth = () => {
    const widths = ["mx-1", "mx-2", "mx-3"];
    return widths[index % widths.length];
  };

  // Add slight delay variation to make animation feel more natural
  const animationDelay = `${(index % 3) * 100}ms`;

  return (
    <tr className="schedule-cell" style={{ height: "48px" }}>
      {/* Checkbox column */}
      {isManager && showCheckbox && (
        <td
          style={{
            width: columnWidths.checkbox,
            minWidth: columnWidths.checkbox,
          }}
          className="p-2 border text-center"
        >
          <div
            className="w-4 h-4 bg-gray-200 rounded animate-pulse mx-auto"
            style={{ animationDelay }}
          ></div>
        </td>
      )}

      {/* Worker name column */}
      <td
        style={{
          width: columnWidths.workerName,
          minWidth: columnWidths.workerName,
        }}
        className="p-2 border"
      >
        <div className="flex items-center gap-2">
          <div
            className={`h-4 bg-gray-200 rounded animate-pulse flex-1 ${getNameWidth()}`}
            style={{ animationDelay }}
          ></div>
          <div
            className="h-3 w-6 bg-gray-200 rounded animate-pulse"
            style={{ animationDelay: `${(index % 3) * 100 + 50}ms` }}
          ></div>
        </div>
      </td>

      {/* YOS column */}
      <td
        style={{ width: columnWidths.yos, minWidth: columnWidths.yos }}
        className="p-2 border text-center"
      >
        <div
          className="h-4 w-6 bg-gray-200 rounded animate-pulse mx-auto"
          style={{ animationDelay }}
        ></div>
      </td>

      {/* Day columns */}
      {days.map((day, dayIndex) => (
        <td
          key={day}
          style={{ width: columnWidths.day, minWidth: columnWidths.day }}
          className="p-2 border text-center"
        >
          <div
            className={`h-4 bg-gray-200 rounded animate-pulse ${getShiftWidth()}`}
            style={{ animationDelay: `${((index + dayIndex) % 7) * 50}ms` }}
          ></div>
        </td>
      ))}

      {/* Hours column */}
      <td
        style={{ width: columnWidths.total, minWidth: columnWidths.total }}
        className="p-2 border text-center"
      >
        <div
          className="h-4 w-8 bg-gray-200 rounded animate-pulse mx-auto"
          style={{ animationDelay: `${(index % 3) * 100 + 200}ms` }}
        ></div>
      </td>
    </tr>
  );
};

export default SkeletonWorkerRow;
