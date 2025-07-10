// src/components/WorkerDetailModal.jsx

import React, { useState, useEffect } from "react";
import { Pencil, Calendar } from "lucide-react";
import OffRulesModal from "./OffRulesModal";

const WorkerDetailModal = ({
  worker,
  company,
  onClose,
  onEdit,
  onDelete,
  isManager,
}) => {
  const [isOffRulesModalOpen, setIsOffRulesModalOpen] = useState(false);

  // Prevent body scrolling when modal is open
  useEffect(() => {
    if (worker) {
      // Store original overflow style
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = "hidden";

      // Cleanup function to restore original overflow
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [worker]);

  if (!worker) return null;

  return (
    <>
      <OffRulesModal
        worker={worker}
        company={company}
        isOpen={isOffRulesModalOpen}
        onClose={() => setIsOffRulesModalOpen(false)}
      />
      <div
        className="fixed inset-0 bg-black/60 flex items-center justify-center z-40 p-4"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-lg shadow-xl w-full max-w-sm"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6">
            <h3 className="text-2xl font-semibold text-gray-800">
              {worker.fullName}
            </h3>
            {isManager && (
              <p className="text-gray-500">
                {worker.isMinor ? "Minor" : "Adult"}
              </p>
            )}
            <div className="mt-4 space-y-1 text-sm">
              <div className="flex justify-between border-b pb-1 border-gray-400">
                <span className="font-semibold text-gray-600">Position:</span>
                <span className="text-gray-800">{worker.title}</span>
              </div>
              <div className="flex justify-between border-b pb-1 border-gray-400">
                <span className="font-semibold text-gray-600">Email:</span>
                <span className="text-gray-800">
                  {worker.email || "Not provided"}
                </span>
              </div>
              <div className="flex justify-between border-b pb-1 border-gray-400">
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
          <div className="bg-gray-50 border-t border-gray-200 p-3 space-y-2 rounded-b-lg">
            {isManager ? (
              <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end sm:gap-1">
                <button
                  onClick={() => onDelete(worker.uid)}
                  className="px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300 text-sm"
                >
                  Remove
                </button>
                <button
                  onClick={() => setIsOffRulesModalOpen(true)}
                  className="text-nowrap flex items-center justify-center gap-2 px-3 py-2 text-red-600 bg-red-100 rounded-md hover:bg-red-200 text-sm"
                >
                  <Calendar width={16} />
                  OFF Rules
                </button>
                <button
                  onClick={() => onEdit(worker)}
                  className="px-4 py-2 flex items-center justify-center gap-2 text-blue-600 bg-blue-100 rounded-md hover:bg-blue-200 text-sm"
                >
                  <Pencil width={16} />
                  Edit
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 text-sm"
                >
                  Close
                </button>
              </div>
            ) : (
              <div className="flex justify-end">
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 text-sm"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default WorkerDetailModal;
