// src/components/EasyAddToolbar.jsx

import React, { useState } from "react";
import { X } from "lucide-react";
import { formatTime12hr } from "../utils/scheduleUtils";

const EasyAddToolbar = ({ presets, onPresetSelect, activePreset, onClear }) => {
  const [selectedRole, setSelectedRole] = useState("GUARD");
  const applicablePresets = presets.filter((p) =>
    p.applicableTo.includes(selectedRole)
  );

  const handleResetClick = () => {
    onPresetSelect({ isReset: true }, selectedRole);
  };

  return (
    <div
      className="floating-toolbar fixed bottom-0 left-1/2 w-auto bg-gray-500 text-white p-2 rounded-t-lg shadow flex items-center gap-2 z-30"
      style={{
        transform: "translateX(-50%)",
        minHeight: "48px", // Fixed height to prevent CLS
        maxWidth: "90vw", // Prevent overflow on small screens
      }}
    >
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
        <button
          onClick={handleResetClick}
          className={`text-xs px-3 py-1 rounded ${
            activePreset?.isReset
              ? "bg-red-500 ring-2 ring-red-300 text-white"
              : "bg-gray-600 hover:bg-gray-700"
          }`}
        >
          -
        </button>
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

export default EasyAddToolbar;
