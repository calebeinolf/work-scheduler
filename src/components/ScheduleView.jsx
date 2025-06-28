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
import { useLocation, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import EditWorkerModal from "./EditWorkerModal";
import ShiftEditPopover from "./ShiftEditPopover";
import WorkerDetailModal from "./WorkerDetailModal";
import WorkerRow from "./WorkerRow";
import PersonalScheduleRow from "./PersonalScheduleRow";
import BulkActionsBar from "./BulkActionsBar";
import EasyAddToolbar from "./EasyAddToolbar";
import FloatingPresetChip from "./FloatingPresetChip";
import {
  ArrowLeft,
  ArrowRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Loader from "../assets/Loader";
import {
  deepEqual,
  getSundayOfWeek,
  getShiftCategory,
  columnWidths,
  calculateDailyHours,
  formatTime12hr,
  shouldShowShiftType,
} from "../utils/scheduleUtils";

const ScheduleView = ({
  company,
  workers,
  presets,
  isManager = true,
  currentUserId,
}) => {
  const location = useLocation();
  const navigate = useNavigate();

  const getInitialDateFromHash = () => {
    const hash = window.location.hash.substring(1);
    if (hash && /^\d{8}$/.test(hash)) {
      const month = parseInt(hash.substring(0, 2), 10) - 1;
      const day = parseInt(hash.substring(2, 4), 10);
      const year = parseInt(hash.substring(4, 8), 10);
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    return new Date();
  };

  const [currentDate, setCurrentDate] = useState(getInitialDateFromHash);
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

  const isPublished = scheduleDocData?.isPublished || false;

  // Create filtered schedule data for non-managers when schedule is unpublished
  const displayScheduleData = useMemo(() => {
    if (isManager || isPublished) {
      return scheduleData;
    }

    // For non-managers when unpublished, only show OFF and SWIM MEET statuses
    const filteredData = {};
    Object.keys(scheduleData).forEach((workerId) => {
      const workerShifts = scheduleData[workerId];
      const filteredWorkerShifts = {};

      Object.keys(workerShifts).forEach((day) => {
        const dayShifts = workerShifts[day];
        if (Array.isArray(dayShifts)) {
          // Only keep OFF and SWIM MEET statuses
          const statusShifts = dayShifts.filter(
            (shift) => shift.type === "OFF" || shift.type === "SWIM MEET"
          );
          if (statusShifts.length > 0) {
            filteredWorkerShifts[day] = statusShifts;
          }
        }
      });

      if (Object.keys(filteredWorkerShifts).length > 0) {
        filteredData[workerId] = filteredWorkerShifts;
      }
    });

    return filteredData;
  }, [scheduleData, isManager, isPublished]);

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

  // Update URL hash when weekStartDate changes
  useEffect(() => {
    const month = String(weekStartDate.getMonth() + 1).padStart(2, "0");
    const day = String(weekStartDate.getDate()).padStart(2, "0");
    const year = weekStartDate.getFullYear();
    const newHash = `#${month}${day}${year}`;
    if (location.hash !== newHash) {
      navigate({ hash: newHash }, { replace: true });
    }
  }, [weekStartDate, navigate, location.hash]);

  // Listen for hash changes (e.g., browser back/forward)
  useEffect(() => {
    const handleHashChange = () => {
      setCurrentDate(getInitialDateFromHash());
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    const unsubscribe = onSnapshot(scheduleDocRef, async (docSnap) => {
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
        : docData.shifts || {};

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
      const existingShifts = Array.isArray(currentShifts) ? currentShifts : [];
      const newShiftsToAdd = Array.isArray(newShiftData)
        ? newShiftData
        : [newShiftData];
      newScheduleData[worker.uid][day] = [...existingShifts, ...newShiftsToAdd];
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
      if (activePreset.isReset) {
        // Reset the cell to empty
        handleSaveShift(worker, day, null, "replace");
      } else {
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
      }
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
          <th
            style={{
              width: columnWidths.checkbox,
              minWidth: columnWidths.checkbox,
            }}
            className="header-cell-padding border text-center"
          >
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
          style={{
            width: columnWidths.workerName,
            minWidth: columnWidths.workerName,
          }}
          className={`header-cell-padding border text-left text-xs font-semibold text-gray-600 bg-gray-100`}
          onMouseEnter={() => handleHeaderMouseEnter("name")}
        >
          Worker
        </th>
        <th
          style={{ width: columnWidths.yos, minWidth: columnWidths.yos }}
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
            style={{ width: columnWidths.day, minWidth: columnWidths.day }}
            className={`header-cell-padding border text-xs font-semibold text-gray-600 transition-colors duration-100 ${
              hoveredCell.col === dayKey ? "bg-blue-100" : "bg-gray-100"
            }`}
            onMouseEnter={() => handleHeaderMouseEnter(dayKey)}
          >
            <div>{headerDates[i]}</div>
            <div className="flex items-center justify-center gap-3">
              <div className="text-blue-600 font-semibold text-xs">
                {dailyStaffCounts[dayKey]?.GUARD || "0"}{" "}
                <span className="font-medium"> G</span>
              </div>
              <div className="text-green-600 font-semibold text-xs">
                {dailyStaffCounts[dayKey]?.FRONT || "0"}{" "}
                <span className="font-medium"> F</span>
              </div>
            </div>
          </th>
        ))}
        <th
          style={{ width: columnWidths.total, minWidth: columnWidths.total }}
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
      ? Object.values(weeklyShifts).reduce((total, dayShifts) => {
          // Only count work shifts for print hours
          const workShifts = Array.isArray(dayShifts)
            ? dayShifts.filter(
                (s) => s.type !== "OFF" && s.type !== "SWIM MEET"
              )
            : [];
          return total + calculateDailyHours(workShifts, worker.isMinor);
        }, 0)
      : 0;

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
                      let statusContent = "";
                      let shiftsContent = "";

                      // Check for OFF/SWIM MEET status
                      dayShifts.forEach((s) => {
                        if (s.type === "OFF") {
                          // Show custom label if present, otherwise just "OFF"
                          const offLabel =
                            s.label && s.label.trim()
                              ? s.label
                              : s.customText && s.customText.trim()
                              ? s.customText
                              : s.start && s.end
                              ? `OFF ${formatTime12hr(
                                  s.start
                                )}-${formatTime12hr(s.end)}`
                              : "OFF";
                          statusContent += `<div style="color: #ef4444; font-size: 10px;">${offLabel}</div>`;
                        }
                        if (s.type === "SWIM MEET") {
                          statusContent +=
                            '<div style="color: #ff8904; font-size: 10px;">SWIM MEET</div>';
                        }
                      });

                      // Get work shifts
                      const workShifts = dayShifts.filter(
                        (s) => s.type !== "OFF" && s.type !== "SWIM MEET"
                      );
                      if (workShifts.length > 0) {
                        shiftsContent = workShifts
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

                      cellContent =
                        statusContent + shiftsContent || cellContent;
                    }
                    return `<td style="padding: 2px; border: 1px solid #e7e7eb; text-align: center;">${cellContent}</td>`;
                  })
                  .join("")}
                <td style="padding: 2px; border: 1px solid #e7e7eb; text-align: center; font-weight: 500;">${weeklyTotal.toFixed(
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
          font-weight: semibold; 
          padding: 3px; 
          background-color: #f3f4f6; 
          border-bottom: 1px solid #e5e7eb;
          text-align: left;
        }
        </style>
      </head>
      <body>
        <p style="text-align:center; font-weight: semibold; margin: 0; margin-bottom: 4px">Schedule for ${formatWeekRange(
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
  const headerContainerRef = useRef(null);
  const mainContentRef = useRef(null);
  const topScrollbarRef = useRef(null);
  const isSyncingRef = useRef(false);
  const [showTopScrollbar, setShowTopScrollbar] = useState(false);

  useEffect(() => {
    const mainContentEl = mainContentRef.current;
    const topScrollbarEl = topScrollbarRef.current;
    const headerContainerEl = headerContainerRef.current;

    if (!mainContentEl || !topScrollbarEl || !headerContainerEl || loading)
      return;

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
      headerContainerEl.scrollLeft = mainContentEl.scrollLeft;
      isSyncingRef.current = false;
    };

    const handleTopScroll = () => {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;
      mainContentEl.scrollLeft = topScrollbarEl.scrollLeft;
      headerContainerEl.scrollLeft = topScrollbarEl.scrollLeft;
      isSyncingRef.current = false;
    };

    mainContentEl.addEventListener("scroll", handleMainScroll);
    topScrollbarEl.addEventListener("scroll", handleTopScroll);

    const resizeObserver = new ResizeObserver(checkOverflow);
    resizeObserver.observe(mainContentEl);

    return () => {
      if (mainContentEl) {
        mainContentEl.removeEventListener("scroll", handleMainScroll);
        resizeObserver.unobserve(mainContentEl);
      }
      if (topScrollbarEl) {
        topScrollbarEl.removeEventListener("scroll", handleTopScroll);
      }
    };
  }, [scheduleData, workers, loading]); // Rerun when data or loading state changes
  // --- END: Dual Scrollbar Logic ---

  return (
    <div className="pb-24">
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
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
      {/* No Schedule Published Message */}
      {!isManager && !loading && !isPublished && (
        <div className="text-center p-8 ">
          <p className="text-red-600">
            The schedule for this week has not been published yet.
          </p>
        </div>
      )}

      {/* Personal Schedule Row for Current Worker */}
      {!isManager && currentUserId && (
        <PersonalScheduleRow
          worker={workers.find((w) => w.uid === currentUserId)}
          scheduleData={displayScheduleData}
          weekStartDate={weekStartDate}
          isPublished={isPublished}
        />
      )}

      {/* Header */}
      <div className="sticky top-0 z-10">
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

        {/* Week Header */}
        <div
          ref={headerContainerRef}
          className="overflow-x-auto no-scrollbar sticky top-0 z-10 shadow-md"
        >
          <table
            className="w-full border-collapse border"
            style={{ tableLayout: "fixed" }}
          >
            <thead>{renderWeekHeader()}</thead>
          </table>
        </div>

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
      </div>

      {/* Schedule Table */}
      <div className="overflow-x-auto" ref={mainContentRef}>
        <table
          ref={tableRef}
          className="w-full border-collapse border"
          style={{ tableLayout: "fixed" }}
          onMouseLeave={() => {
            setHoveredCell({ row: null, col: null });
          }}
        >
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={11} className="text-center p-4">
                  <Loader /> Loading schedule...
                </td>
              </tr>
            ) : (
              sortedManagersAndGuards.map((worker) => (
                <WorkerRow
                  key={worker.uid}
                  worker={worker}
                  scheduleData={displayScheduleData}
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
                    <td
                      style={{
                        width: columnWidths.checkbox,
                        minWidth: columnWidths.checkbox,
                      }}
                      className="p-2 border"
                    >
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
                    scheduleData={displayScheduleData}
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

      {/* Key */}
      <div className="w-full mt-8 mb-2 flex flex-wrap gap-4 items-center justify-center text-xs text-gray-600">
        <span>
          <span className="font-semibold text-gray-800">Shifts Key:</span>
        </span>
        <span>
          <span className="font-semibold text-gray-800">(M)</span> Manager
        </span>
        <span>
          <span className="font-semibold text-gray-800">(G)</span> Guard
        </span>
        <span>
          <span className="font-semibold text-gray-800">(L)</span> Lessons
        </span>
        <span>
          <span className="font-semibold text-gray-800">(C)</span> Camp
        </span>
      </div>
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

export default ScheduleView;
