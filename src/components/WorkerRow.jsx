// src/components/WorkerRow.jsx

import React, { useMemo } from "react";
import {
  columnWidths,
  calculateDailyHours,
  formatTime12hr,
  formatHours,
  shouldShowShiftType,
  getShiftHighlightClass,
} from "../utils/scheduleUtils";

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
  getPendingOffRequests,
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

  const handleMouseEnter = (rowId, colId) => {
    if (!popoverTarget) onCellEnter({ row: rowId, col: colId });
  };

  const weeklyShifts = scheduleData[worker.uid];
  const weeklyTotal = useMemo(() => {
    if (!weeklyShifts) return 0;
    let totalHours = 0;
    Object.values(weeklyShifts).forEach((dayShifts) => {
      // Only count actual work shifts for hours calculation
      const workShifts = Array.isArray(dayShifts)
        ? dayShifts.filter((s) => s.type !== "OFF" && s.type !== "SWIM MEET")
        : [];
      totalHours += calculateDailyHours(workShifts, worker.isMinor);
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
          style={{
            width: columnWidths.checkbox,
            minWidth: columnWidths.checkbox,
          }}
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
        style={{
          width: columnWidths.workerName,
          minWidth: columnWidths.workerName,
        }}
        className={`cell-padding !pl-1 border text-sm no-scrollbar overflow-auto transition-colors duration-100 cursor-pointer ${getCellClass(
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
        style={{ width: columnWidths.yos, minWidth: columnWidths.yos }}
        className={`cell-padding border text-sm text-center transition-colors duration-100 ${getCellClass(
          "yos"
        )}`}
        onMouseEnter={() => handleMouseEnter(worker.uid, "yos")}
      >
        {worker.yos ?? 0}
      </td>
      {["sun", "mon", "tue", "wed", "thu", "fri", "sat"].map((day) => {
        const dayShifts = weeklyShifts?.[day];
        const isRevealed = revealedHoursWorkerId === worker.uid;
        const pendingRequests = getPendingOffRequests
          ? getPendingOffRequests(worker.uid, day)
          : [];

        let dailyTotalHours = 0;
        if (isRevealed && Array.isArray(dayShifts)) {
          // Only count work shifts for hours display
          const workShifts = dayShifts.filter(
            (s) => s.type !== "OFF" && s.type !== "SWIM MEET"
          );
          dailyTotalHours = calculateDailyHours(workShifts, worker.isMinor);
        }

        return (
          <td
            key={day}
            style={{ width: columnWidths.day, minWidth: columnWidths.day }}
            className={`cell-padding border text-center transition-colors duration-100 ${
              isManager ? "cursor-pointer" : ""
            } ${getCellClass(day)}`}
            onMouseEnter={() => handleMouseEnter(worker.uid, day)}
            onClick={(e) => onCellClick(e, worker, day)}
          >
            {isRevealed ? (
              dailyTotalHours > 0 ? (
                <div className="font-semibold text-sm text-blue-600 h-full flex items-center justify-center">
                  {formatHours(dailyTotalHours)}
                </div>
              ) : (
                <span className="text-gray-400">0</span>
              )
            ) : (
              <div className="space-y-0.5">
                {/* Show pending OFF requests for managers or workers viewing their own schedule */}
                {(isManager || currentUserId === worker.uid) &&
                  pendingRequests.length > 0 &&
                  pendingRequests.map((request, index) => (
                    <div
                      key={`pending-${index}`}
                      className="text-xs font-medium text-white bg-red-400 rounded px-1 py-0.5"
                      title={`Pending OFF request: ${
                        request.reason || "No reason provided"
                      }`}
                    >
                      {request.isAllDay
                        ? "OFF?"
                        : `OFF ${formatTime12hr(
                            request.startTime
                          )}-${formatTime12hr(request.endTime)}?`}
                    </div>
                  ))}

                {/* Show existing OFF/SWIM MEET status */}
                {Array.isArray(dayShifts) && (
                  <>
                    {dayShifts
                      .filter((s) => s.type === "OFF")
                      .map((offShift, index) => (
                        <div
                          key={`off-${index}`}
                          className="text-xs text-red-500"
                        >
                          {offShift.start && offShift.end
                            ? `OFF ${formatTime12hr(
                                offShift.start
                              )}-${formatTime12hr(offShift.end)}`
                            : "OFF"}
                        </div>
                      ))}
                    {dayShifts.filter((s) => s.type === "SWIM MEET").length >
                      0 && (
                      <div className="text-xs text-orange-400">SWIM MEET</div>
                    )}
                    {/* Show work shifts */}
                    {dayShifts
                      .filter((s) => s.type !== "OFF" && s.type !== "SWIM MEET")
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
                          )}-${formatTime12hr(shift.end)}`}</div>
                          {shouldShowShiftType(shift, worker) && (
                            <div className="text-gray-500 text-xs">
                              {shift.type === "CAMP"
                                ? "(C)"
                                : shift.type === "LESSONS"
                                ? "(L)"
                                : `(${shift.type[0]})`}
                            </div>
                          )}
                        </div>
                      ))}
                  </>
                )}

                {/* Show dash if no content */}
                {(!Array.isArray(dayShifts) || dayShifts.length === 0) &&
                  pendingRequests.length === 0 && (
                    <span className="text-gray-400">-</span>
                  )}
              </div>
            )}
          </td>
        );
      })}
      <td
        style={{ width: columnWidths.total, minWidth: columnWidths.total }}
        className={`cell-padding border text-sm ${
          weeklyTotal > 40 &&
          "text-red-500 bg-red-50 border-black font-semibold"
        } text-center transition-colors duration-100 cursor-pointer ${getCellClass(
          "total"
        )}`}
        onMouseEnter={() => handleMouseEnter(worker.uid, "total")}
        onMouseDown={() => onRevealHoursStart(worker.uid)}
        onMouseUp={onRevealHoursEnd}
        onMouseLeave={onRevealHoursEnd}
      >
        {formatHours(weeklyTotal)}
      </td>
    </tr>
  );
};

export default WorkerRow;
