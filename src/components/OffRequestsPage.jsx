// src/components/OffRequestsPage.jsx

import React, { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  deleteDoc,
  updateDoc,
  setDoc,
  getDoc,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  User,
  AlertCircle,
  Trash2,
  Undo2,
  ChevronLeft,
} from "lucide-react";
import { getSundayOfWeek } from "../utils/scheduleUtils";
import RequestOffModal from "./RequestOffModal";

// Configuration constants
const REQUESTS_PER_PAGE = 10;

const OffRequestsPage = ({ user, company, onBack, isManager = false }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingRequest, setProcessingRequest] = useState(null);
  const [activeTab, setActiveTab] = useState("pending");
  const [currentPage, setCurrentPage] = useState(1);
  const [isRequestOffModalOpen, setIsRequestOffModalOpen] = useState(false);

  useEffect(() => {
    if (!company?.id) return;
    if (!isManager && !user?.uid && !user?.id) return;

    let requestsQuery;
    if (isManager) {
      // Manager sees all requests for the company
      requestsQuery = query(
        collection(db, "offRequests"),
        where("companyId", "==", company.id)
      );
    } else {
      // Worker sees only their own requests
      const userId = user.uid || user.id;
      requestsQuery = query(
        collection(db, "offRequests"),
        where("companyId", "==", company.id),
        where("workerId", "==", userId)
      );
    }

    const unsubscribe = onSnapshot(
      requestsQuery,
      (snapshot) => {
        const requestsList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        // Sort by request date, newest first
        requestsList.sort(
          (a, b) => new Date(b.requestedAt) - new Date(a.requestedAt)
        );
        setRequests(requestsList);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching off requests:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [company, user, isManager]);

  // Manager functions
  const handleApproveRequest = async (request) => {
    setProcessingRequest(request.id);
    try {
      // Update the request status
      await updateDoc(doc(db, "offRequests", request.id), {
        status: "approved",
        approvedAt: new Date().toISOString(),
        approvedBy: "manager",
        // Clear denied fields if it was previously denied
        ...(request.status === "denied" && {
          deniedAt: null,
          deniedBy: null,
        }),
      });

      // Apply the OFF to schedules
      const startDate = new Date(request.startDate + "T00:00:00");
      const endDate = new Date(request.endDate + "T00:00:00");

      await applyOffToSchedules(startDate, endDate, request.workerId, {
        isAllDay: request.isAllDay,
        startTime: request.startTime,
        endTime: request.endTime,
      });
    } catch (error) {
      console.error("Error approving request:", error);
      alert("Failed to approve request. Please try again.");
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleDenyRequest = async (request) => {
    // If request is already approved, show confirmation
    if (request.status === "approved") {
      if (
        !window.confirm(
          "This request has already been approved and may have OFF time scheduled. Are you sure you want to deny it? This will remove any scheduled OFF time."
        )
      ) {
        return;
      }

      // Remove OFF shifts from schedules if it was previously approved
      try {
        await removeOffFromSchedules(
          request.startDate,
          request.endDate,
          request.workerId,
          {
            isAllDay: request.isAllDay,
            startTime: request.startTime,
            endTime: request.endTime,
          }
        );
      } catch (error) {
        console.error("Error removing OFF from schedules:", error);
        alert("Failed to remove scheduled OFF time. Please try again.");
        return;
      }
    }

    setProcessingRequest(request.id);
    try {
      await updateDoc(doc(db, "offRequests", request.id), {
        status: "denied",
        deniedAt: new Date().toISOString(),
        deniedBy: "manager",
        // Clear approved fields if it was previously approved
        ...(request.status === "approved" && {
          approvedAt: null,
          approvedBy: null,
        }),
      });
    } catch (error) {
      console.error("Error denying request:", error);
      alert("Failed to deny request. Please try again.");
    } finally {
      setProcessingRequest(null);
    }
  };

  const applyOffToSchedules = async (
    startDate,
    endDate,
    workerId,
    timeDetails
  ) => {
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      const sunday = getSundayOfWeek(current);
      const scheduleId = `${company.id}_${sunday.getFullYear()}-${String(
        sunday.getMonth() + 1
      ).padStart(2, "0")}-${String(sunday.getDate()).padStart(2, "0")}`;

      try {
        // Get or create the schedule document
        const scheduleDocRef = doc(db, "schedules", scheduleId);
        const scheduleDoc = await getDocs(
          query(
            collection(db, "schedules"),
            where("__name__", "==", scheduleId)
          )
        );

        let scheduleData;
        if (scheduleDoc.empty) {
          // Create new schedule if it doesn't exist
          scheduleData = {
            companyId: company.id,
            weekOf: sunday,
            isPublished: false,
            shifts: {},
          };
          await setDoc(scheduleDocRef, scheduleData);
        } else {
          scheduleData = scheduleDoc.docs[0].data();

          // Skip if schedule is published
          if (scheduleData.isPublished) {
            current.setDate(current.getDate() + 1);
            continue;
          }
        }

        // Determine the day of week for this date
        const dayOfWeek = current.getDay();
        const dayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
        const dayKey = dayKeys[dayOfWeek];

        // Create the OFF shift
        const offShift = {
          type: "OFF",
          isRequest: true,
          requestId: crypto.randomUUID(),
        };

        if (!timeDetails.isAllDay) {
          offShift.start = timeDetails.startTime;
          offShift.end = timeDetails.endTime;
        }

        // Update the schedule
        const updatedShifts = { ...scheduleData.shifts };
        if (!updatedShifts[workerId]) {
          updatedShifts[workerId] = {};
        }
        if (!updatedShifts[workerId][dayKey]) {
          updatedShifts[workerId][dayKey] = [];
        }

        // Check if there's already an OFF shift to avoid duplicates
        const existingOffShift = updatedShifts[workerId][dayKey].find(
          (shift) => shift.type === "OFF" && shift.isRequest
        );

        if (!existingOffShift) {
          updatedShifts[workerId][dayKey].push(offShift);

          // Update the schedule document
          await setDoc(
            scheduleDocRef,
            { shifts: updatedShifts },
            { merge: true }
          );
        }
      } catch (error) {
        console.error(
          "Error applying OFF to schedule for date",
          current.toDateString(),
          ":",
          error
        );
      }

      current.setDate(current.getDate() + 1);
    }
  };

  // Worker functions
  const handleDeleteRequest = async (request) => {
    if (request.status !== "pending") {
      alert("Only pending requests can be deleted.");
      return;
    }

    if (
      !window.confirm(
        "Are you sure you want to delete this request? This action cannot be undone."
      )
    ) {
      return;
    }

    setProcessingRequest(request.id);
    try {
      await deleteDoc(doc(db, "offRequests", request.id));
    } catch (error) {
      console.error("Error deleting request:", error);
      alert("Failed to delete request. Please try again.");
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleRetractRequest = async (request) => {
    if (request.status !== "approved") {
      alert("Only approved requests can be retracted.");
      return;
    }

    if (
      !window.confirm(
        "Are you sure you want to retract this approved request? This will remove your OFF time from the schedule."
      )
    ) {
      return;
    }

    setProcessingRequest(request.id);
    try {
      // Remove OFF shifts from schedules
      await removeOffFromSchedules(
        request.startDate,
        request.endDate,
        request.workerId,
        {
          isAllDay: request.isAllDay,
          startTime: request.startTime,
          endTime: request.endTime,
        }
      );

      // Update the request status to retracted
      await updateDoc(doc(db, "offRequests", request.id), {
        status: "retracted",
        retractedAt: new Date().toISOString(),
        retractedBy: user.uid || user.id,
      });
    } catch (error) {
      console.error("Error retracting request:", error);
      alert("Failed to retract request. Please try again.");
    } finally {
      setProcessingRequest(null);
    }
  };

  const removeOffFromSchedules = async (
    startDateStr,
    endDateStr,
    workerId,
    timeDetails
  ) => {
    const startDate = new Date(startDateStr + "T00:00:00");
    const endDate = new Date((endDateStr || startDateStr) + "T00:00:00");

    const current = new Date(startDate);
    while (current <= endDate) {
      try {
        // Get the Sunday of the week for this date
        const sundayOfWeek = getSundayOfWeek(current);
        const scheduleDocId = `${
          company.id
        }_${sundayOfWeek.getFullYear()}-${String(
          sundayOfWeek.getMonth() + 1
        ).padStart(2, "0")}-${String(sundayOfWeek.getDate()).padStart(2, "0")}`;

        const scheduleDocRef = doc(db, "schedules", scheduleDocId);

        // Get current schedule data
        const scheduleDocSnap = await getDoc(scheduleDocRef);

        if (!scheduleDocSnap.exists()) {
          current.setDate(current.getDate() + 1);
          continue;
        }

        const scheduleData = scheduleDocSnap.data();

        if (!scheduleData || !scheduleData.shifts) {
          current.setDate(current.getDate() + 1);
          continue;
        }

        const dayOfWeek = current.getDay();
        const dayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
        const dayKey = dayKeys[dayOfWeek];

        const updatedShifts = { ...scheduleData.shifts };
        if (
          updatedShifts[workerId] &&
          updatedShifts[workerId][dayKey] &&
          Array.isArray(updatedShifts[workerId][dayKey])
        ) {
          // Remove OFF shifts that were created by requests
          const filteredShifts = updatedShifts[workerId][dayKey].filter(
            (shift) => !(shift.type === "OFF" && shift.isRequest)
          );

          // If there are no shifts left, set to null to clean up
          updatedShifts[workerId][dayKey] =
            filteredShifts.length > 0 ? filteredShifts : null;

          // Update the schedule document
          await setDoc(
            scheduleDocRef,
            { shifts: updatedShifts },
            { merge: true }
          );
        }
      } catch (error) {
        console.error(
          "Error removing OFF from schedule for date",
          current.toDateString(),
          ":",
          error
        );
      }

      current.setDate(current.getDate() + 1);
    }
  };

  // Filter requests based on active tab
  const pendingRequests = requests.filter((req) => req.status === "pending");
  const historyRequests = requests.filter((req) => req.status !== "pending");

  // Get current requests for active tab
  const currentRequests =
    activeTab === "pending" ? pendingRequests : historyRequests;

  // Calculate pagination
  const totalPages = Math.ceil(currentRequests.length / REQUESTS_PER_PAGE);
  const startIndex = (currentPage - 1) * REQUESTS_PER_PAGE;
  const endIndex = startIndex + REQUESTS_PER_PAGE;
  const paginatedRequests = currentRequests.slice(startIndex, endIndex);

  // Reset to page 1 when switching tabs
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const formatDate = (dateString) => {
    return new Date(dateString + "T00:00:00").toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (timeString) => {
    if (!timeString) return "";
    const [hours, minutes] = timeString.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
            <AlertCircle size={12} />
            Pending
          </span>
        );
      case "approved":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
            <CheckCircle size={12} />
            Approved
          </span>
        );
      case "denied":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
            <XCircle size={12} />
            Denied
          </span>
        );
      case "retracted":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
            <Undo2 size={12} />
            Retracted
          </span>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-500">Loading requests...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6 gap-4">
          <div className="min-w-24">
            <button
              onClick={onBack}
              className="pl-3 pr-4 py-2 flex items-center justify-center gap-1 bg-gray-200 rounded-md hover:bg-gray-300"
            >
              <ChevronLeft size={20} />
              Back
            </button>
          </div>

          <div className="flex-1 min-w-0 text-center">
            <h2 className="text-2xl font-bold text-gray-800">
              {isManager ? "Manage OFF Requests" : "My OFF Requests"}
            </h2>
            <p className="text-gray-600 mt-1 truncate">
              {isManager
                ? "Review and approve time off requests from your team"
                : "View and manage your time off requests"}
            </p>
          </div>

          <div className="min-w-24 flex justify-end">
            {!isManager && (
              <button
                className="pl-3 pr-4 py-2 bg-red-500 rounded-md hover:bg-red-600 text-white"
                onClick={() => setIsRequestOffModalOpen(true)}
              >
                Request OFF
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => handleTabChange("pending")}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === "pending"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Pending ({pendingRequests.length})
            </button>
            <button
              onClick={() => handleTabChange("history")}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === "history"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Request History ({historyRequests.length})
            </button>
          </nav>
        </div>

        {/* Table Content */}
        <div className="bg-white border border-gray-300 rounded-lg overflow-hidden">
          {/* Table Header */}
          <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
            <div className="grid grid-cols-12 gap-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
              {isManager && <div className="col-span-2">Worker</div>}
              <div className={isManager ? "col-span-2" : "col-span-3"}>
                Date(s)
              </div>
              <div className="col-span-2">Time</div>
              <div className={isManager ? "col-span-2" : "col-span-3"}>
                Reason
              </div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Actions</div>
            </div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-gray-200">
            {paginatedRequests.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <Calendar size={48} className="mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">
                  {activeTab === "pending"
                    ? "No pending requests"
                    : "No request history"}
                </h3>
                <p className="text-gray-500">
                  {activeTab === "pending"
                    ? isManager
                      ? "Pending requests will appear here when submitted by workers."
                      : "You haven't submitted any pending requests."
                    : isManager
                    ? "Approved, denied, and auto-approved requests will appear here."
                    : "Your approved, denied, and auto-approved requests will appear here."}
                </p>
              </div>
            ) : (
              paginatedRequests.map((request) => (
                <div key={request.id} className="px-6 py-2 hover:bg-gray-50">
                  <div className="grid grid-cols-12 gap-4 items-center">
                    {/* Worker - Only show for managers */}
                    {isManager && (
                      <div className="col-span-2">
                        <div className="text-sm font-medium text-gray-900">
                          {request.workerName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {request.workerEmail}
                        </div>
                      </div>
                    )}

                    {/* Date(s) */}
                    <div className={isManager ? "col-span-2" : "col-span-3"}>
                      <div className="text-sm text-gray-900">
                        {formatDate(request.startDate)}
                        {request.endDate &&
                          request.endDate !== request.startDate && (
                            <div> to {formatDate(request.endDate)}</div>
                          )}
                      </div>
                    </div>

                    {/* Time */}
                    <div className="col-span-2">
                      <div className="text-sm text-gray-900">
                        {request.isAllDay
                          ? "All Day"
                          : `${formatTime(request.startTime)} - ${formatTime(
                              request.endTime
                            )}`}
                      </div>
                    </div>

                    {/* Reason */}
                    <div className={isManager ? "col-span-2" : "col-span-3"}>
                      <div
                        className="text-sm text-gray-900 truncate"
                        title={request.reason}
                      >
                        {request.reason || "-"}
                      </div>
                    </div>

                    {/* Status */}
                    <div className="col-span-2">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(request.status)}
                        {request.isAutoApproved && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                            Auto
                          </span>
                        )}
                      </div>
                      {activeTab === "history" && (
                        <div className="text-xs text-gray-500 mt-1 flex flex-col gap-1">
                          {request.approvedAt && (
                            <div>
                              Approved:{" "}
                              {new Date(
                                request.approvedAt
                              ).toLocaleDateString()}
                            </div>
                          )}

                          {request.deniedAt && (
                            <div>
                              Denied:{" "}
                              {new Date(request.deniedAt).toLocaleDateString()}
                            </div>
                          )}

                          {request.retractedAt && (
                            <div>
                              Retracted:{" "}
                              {new Date(
                                request.retractedAt
                              ).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="col-span-2">
                      {isManager ? (
                        // Manager actions
                        request.status === "pending" ||
                        request.status === "approved" ||
                        request.status === "denied" ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleDenyRequest(request)}
                              disabled={
                                processingRequest === request.id ||
                                request.status === "denied"
                              }
                              className={`px-2 py-1 text-xs rounded disabled:opacity-50 ${
                                request.status === "denied"
                                  ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                                  : "bg-red-100 text-red-700 hover:bg-red-200"
                              }`}
                            >
                              {processingRequest === request.id
                                ? "..."
                                : "Deny"}
                            </button>
                            <button
                              onClick={() => handleApproveRequest(request)}
                              disabled={
                                processingRequest === request.id ||
                                request.status === "approved"
                              }
                              className={`px-2 py-1 text-xs rounded disabled:opacity-50 ${
                                request.status === "approved"
                                  ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                                  : "bg-green-100 text-green-700 hover:bg-green-200"
                              }`}
                            >
                              {processingRequest === request.id
                                ? "..."
                                : "Approve"}
                            </button>
                          </div>
                        ) : (
                          <div className="text-xs text-gray-500">
                            {request.status === "retracted"
                              ? "Retracted by worker"
                              : request.approvedBy === "system"
                              ? "Auto-approved"
                              : "No actions available"}
                          </div>
                        )
                      ) : // Worker actions
                      request.status === "pending" ? (
                        <button
                          onClick={() => handleDeleteRequest(request)}
                          disabled={processingRequest === request.id}
                          className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50 flex items-center gap-1"
                          title="Delete request"
                        >
                          <Trash2 size={12} />
                          {processingRequest === request.id ? "..." : "Delete"}
                        </button>
                      ) : request.status === "approved" ? (
                        <button
                          onClick={() => handleRetractRequest(request)}
                          disabled={processingRequest === request.id}
                          className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200 disabled:opacity-50 flex items-center gap-1"
                          title="Retract approved request"
                        >
                          <Undo2 size={12} />
                          {processingRequest === request.id ? "..." : "Retract"}
                        </button>
                      ) : (
                        <div className="text-xs text-gray-500">
                          {request.status === "retracted"
                            ? "Retracted by you"
                            : request.approvedBy === "system"
                            ? "Auto-approved"
                            : request.approvedBy
                            ? "Manager approved"
                            : "Manager denied"}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pagination */}
        {currentRequests.length > REQUESTS_PER_PAGE && (
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {startIndex + 1} to{" "}
              {Math.min(endIndex, currentRequests.length)} of{" "}
              {currentRequests.length} results
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>

              {/* Page numbers */}
              <div className="flex gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (page) => {
                    // Show first page, last page, current page, and pages around current page
                    const showPage =
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 1 && page <= currentPage + 1);

                    if (!showPage && page === 2 && currentPage > 4) {
                      return (
                        <span
                          key="ellipsis1"
                          className="px-3 py-2 text-sm text-gray-500"
                        >
                          ...
                        </span>
                      );
                    }

                    if (
                      !showPage &&
                      page === totalPages - 1 &&
                      currentPage < totalPages - 3
                    ) {
                      return (
                        <span
                          key="ellipsis2"
                          className="px-3 py-2 text-sm text-gray-500"
                        >
                          ...
                        </span>
                      );
                    }

                    if (!showPage) return null;

                    return (
                      <button
                        key={page}
                        onClick={() => handlePageChange(page)}
                        className={`px-3 py-2 text-sm border rounded-md ${
                          page === currentPage
                            ? "bg-blue-500 text-white border-blue-500"
                            : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {page}
                      </button>
                    );
                  }
                )}
              </div>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {!isManager && (
        <RequestOffModal
          isOpen={isRequestOffModalOpen}
          onClose={() => setIsRequestOffModalOpen(false)}
          user={user}
          company={company}
        />
      )}
    </div>
  );
};

export default OffRequestsPage;
