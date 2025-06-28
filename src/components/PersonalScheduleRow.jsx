// src/components/PersonalScheduleRow.jsx

import React, { useMemo } from "react";
import {
  columnWidths,
  calculateDailyHours,
  formatTime12hr,
  formatHours,
  shouldShowShiftType,
  getShiftHighlightClass,
} from "../utils/scheduleUtils";

const PersonalScheduleRow = ({
  worker,
  scheduleData,
  weekStartDate,
  isPublished,
}) => {
  if (!worker) return null;

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

  const weeklyShifts = scheduleData[worker.uid];
  const weeklyTotal = useMemo(() => {
    if (!weeklyShifts || !isPublished) return 0; // Don't show hours if not published
    let totalHours = 0;
    Object.values(weeklyShifts).forEach((dayShifts) => {
      const workShifts = Array.isArray(dayShifts)
        ? dayShifts.filter((s) => s.type !== "OFF" && s.type !== "SWIM MEET")
        : [];
      totalHours += calculateDailyHours(workShifts, worker.isMinor);
    });
    return totalHours;
  }, [weeklyShifts, worker.isMinor, isPublished]);

  return (
    <div className="">
      <div className=" px-4 py-2">
        <h3 className="text-lg font-semibold">Your Schedule</h3>
      </div>

      <div className="overflow-x-auto">
        <table
          className="w-full border-collapse"
          style={{ tableLayout: "fixed" }}
        >
          {/* Header Row */}
          <thead>
            <tr className="bg-gray-100">
              {days.map((dayKey, i) => (
                <th
                  key={dayKey}
                  style={{
                    width: columnWidths.day,
                    minWidth: columnWidths.day,
                  }}
                  className="header-cell-padding border text-xs font-semibold  text-center"
                >
                  {headerDates[i]}
                </th>
              ))}
              {isPublished && (
                <th
                  style={{
                    width: columnWidths.total,
                    minWidth: columnWidths.total,
                  }}
                  className="header-cell-padding border text-xs font-semibold  text-center"
                >
                  Hours
                </th>
              )}
            </tr>
          </thead>
          {/* Schedule Row */}
          <tbody>
            <tr className="bg-white">
              {days.map((day) => {
                const dayShifts = weeklyShifts?.[day];
                const workShifts = Array.isArray(dayShifts)
                  ? dayShifts.filter(
                      (s) => s.type !== "OFF" && s.type !== "SWIM MEET"
                    )
                  : [];
                const dailyHours = isPublished
                  ? calculateDailyHours(workShifts, worker.isMinor)
                  : 0;

                return (
                  <td
                    key={day}
                    style={{
                      width: columnWidths.day,
                      minWidth: columnWidths.day,
                    }}
                    className="p-1 border text-center"
                  >
                    <div className="space-y-0.5">
                      {/* Show OFF/SWIM MEET status always */}
                      {Array.isArray(dayShifts) &&
                        dayShifts
                          .filter((s) => s.type === "OFF")
                          .map((offShift, index) => (
                            <div
                              key={`off-${index}`}
                              className="text-xs text-red-500 font-medium"
                            >
                              {offShift.start && offShift.end
                                ? `OFF ${formatTime12hr(
                                    offShift.start
                                  )}-${formatTime12hr(offShift.end)}`
                                : "OFF"}
                            </div>
                          ))}
                      {Array.isArray(dayShifts) &&
                        dayShifts.filter((s) => s.type === "SWIM MEET").length >
                          0 && (
                          <div className="text-xs text-orange-500 font-medium">
                            SWIM MEET
                          </div>
                        )}

                      {/* Show work shifts only if published */}
                      {isPublished &&
                        workShifts.length > 0 &&
                        workShifts
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
                              <div className="font-medium">{`${formatTime12hr(
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

                      {/* Show daily hours only if published */}
                      {isPublished && dailyHours > 0 && (
                        <div className="text-xs text-blue-600 font-medium mt-1">
                          {formatHours(dailyHours)}h
                        </div>
                      )}

                      {/* If nothing at all, show dash */}
                      {!(
                        (Array.isArray(dayShifts) &&
                          (dayShifts.length > 0 ||
                            workShifts.length > 0 ||
                            dayShifts.some(
                              (s) => s.type === "OFF" || s.type === "SWIM MEET"
                            ))) ||
                        dailyHours > 0
                      ) && <span className="text-gray-400">-</span>}
                    </div>
                  </td>
                );
              })}
              {isPublished && (
                <td
                  style={{
                    width: columnWidths.total,
                    minWidth: columnWidths.total,
                  }}
                  className={`cell-padding border text-sm font-medium text-center border-black ${
                    weeklyTotal > 40
                      ? "text-red-600 bg-red-50"
                      : "text-blue-600"
                  }`}
                >
                  {formatHours(weeklyTotal)}
                </td>
              )}
            </tr>
          </tbody>
        </table>
      </div>

      <div className=" px-4 py-2 mt-4">
        <h3 className="text-lg font-semibold">Full Schedule</h3>
      </div>
    </div>
  );
};

export default PersonalScheduleRow;
