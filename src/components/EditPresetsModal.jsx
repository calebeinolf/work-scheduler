// src/components/EditPresetsModal.jsx

import React, { useState, useEffect, useRef } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";

const EditPresetsModal = ({ isOpen, onClose, companyId }) => {
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [justMovedId, setJustMovedId] = useState(null); // For visual feedback
  const scrollContainerRef = useRef(null); // For auto-scrolling
  const shiftTypes = ["GUARD", "MANAGER", "FRONT", "LESSONS"];

  useEffect(() => {
    if (!isOpen || !companyId) return;

    const fetchPresets = async () => {
      setLoading(true);
      const presetsDocRef = doc(db, "shiftPresets", companyId);
      const docSnap = await getDoc(presetsDocRef);
      if (docSnap.exists() && docSnap.data().presets) {
        setPresets(docSnap.data().presets);
      } else {
        setPresets([
          {
            id: crypto.randomUUID(),
            label: "",
            start: "09:00",
            end: "17:00",
            applicableTo: ["GUARD"],
          },
        ]);
      }
      setLoading(false);
    };

    fetchPresets();
  }, [isOpen, companyId]);

  const handlePresetChange = (index, field, value) => {
    const newPresets = [...presets];
    newPresets[index][field] = value;
    setPresets(newPresets);
  };

  const handleCheckboxChange = (index, type) => {
    const newPresets = [...presets];
    const currentApplicable = newPresets[index].applicableTo || [];
    if (currentApplicable.includes(type)) {
      newPresets[index].applicableTo = currentApplicable.filter(
        (t) => t !== type
      );
    } else {
      newPresets[index].applicableTo.push(type);
    }
    setPresets(newPresets);
  };

  const addPreset = () => {
    const newPreset = {
      id: crypto.randomUUID(),
      label: "",
      start: "09:00",
      end: "17:00",
      applicableTo: [],
    };
    setPresets([...presets, newPreset]);

    // Scroll to the bottom after a short delay to allow the DOM to update
    setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({
          top: scrollContainerRef.current.scrollHeight + 50,
          behavior: "smooth",
        });
      }
    }, 100);
  };

  const removePreset = (id) => {
    setPresets(presets.filter((p) => p.id !== id));
  };

  const triggerMoveHighlight = (id) => {
    setJustMovedId(id);
    setTimeout(() => {
      setJustMovedId(null);
    }, 2000);
  };

  const handleReorder = (index, direction) => {
    const newPresets = [...presets];
    let movedId;
    if (direction === "up" && index > 0) {
      [newPresets[index], newPresets[index - 1]] = [
        newPresets[index - 1],
        newPresets[index],
      ];
      movedId = newPresets[index - 1].id;
    } else if (direction === "down" && index < newPresets.length - 1) {
      [newPresets[index], newPresets[index + 1]] = [
        newPresets[index + 1],
        newPresets[index],
      ];
      movedId = newPresets[index + 1].id;
    } else if (direction === "top" && index > 0) {
      const item = newPresets.splice(index, 1)[0];
      newPresets.unshift(item);
      movedId = item.id;
    } else if (direction === "bottom" && index < newPresets.length - 1) {
      const item = newPresets.splice(index, 1)[0];
      newPresets.push(item);
      movedId = item.id;
    }

    if (movedId) {
      setPresets(newPresets);
      triggerMoveHighlight(movedId);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setError("");
    try {
      const presetsDocRef = doc(db, "shiftPresets", companyId);
      await setDoc(presetsDocRef, { presets });
      onClose();
    } catch (err) {
      console.error("Error saving presets:", err);
      setError("Failed to save presets.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <h3 className="text-2xl font-bold text-gray-800 mb-4">
            Edit Shift Presets
          </h3>
          {error && <p className="text-red-500 text-center mb-4">{error}</p>}
          <div
            ref={scrollContainerRef}
            className="space-y-4 max-h-[60vh] overflow-y-auto pr-4"
          >
            {loading ? (
              <p>Loading presets...</p>
            ) : (
              presets.map((preset, index) => (
                <div
                  key={preset.id}
                  className={`flex items-center gap-3 p-3 rounded-lg bg-gray-50 transition-all duration-1000 ${
                    justMovedId === preset.id
                      ? "border-2 border-blue-800"
                      : "border"
                  }`}
                >
                  <div className="flex flex-col justify-center">
                    <button
                      type="button"
                      onClick={() => handleReorder(index, "top")}
                      disabled={index === 0}
                      className="p-1 text-gray-400 hover:text-black disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 17l7-7 7 7M5 11l7-7 7 7"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReorder(index, "up")}
                      disabled={index === 0}
                      className="p-1 text-gray-400 hover:text-black disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 15l7-7 7 7"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReorder(index, "down")}
                      disabled={index === presets.length - 1}
                      className="p-1 text-gray-400 hover:text-black disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReorder(index, "bottom")}
                      disabled={index === presets.length - 1}
                      className="p-1 text-gray-400 hover:text-black disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 rotate-180"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 17l7-7 7 7M5 11l7-7 7 7"
                        />
                      </svg>
                    </button>
                  </div>
                  <div className="flex-grow space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <input
                        type="text"
                        placeholder="Preset Label (e.g., Morning)"
                        value={preset.label}
                        onChange={(e) =>
                          handlePresetChange(index, "label", e.target.value)
                        }
                        className="p-2 border rounded-md"
                      />
                      <input
                        type="time"
                        value={preset.start}
                        onChange={(e) =>
                          handlePresetChange(index, "start", e.target.value)
                        }
                        className="p-2 border rounded-md"
                      />
                      <input
                        type="time"
                        value={preset.end}
                        onChange={(e) =>
                          handlePresetChange(index, "end", e.target.value)
                        }
                        className="p-2 border rounded-md"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2">
                      <span className="text-sm font-medium">Apply to:</span>
                      {shiftTypes.map((type) => (
                        <label
                          key={type}
                          className="flex items-center space-x-1 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={preset.applicableTo.includes(type)}
                            onChange={() => handleCheckboxChange(index, type)}
                            className="rounded"
                          />
                          <span>{type}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => removePreset(preset.id)}
                    className="ml-auto text-red-500 hover:text-red-700 text-xl self-start"
                  >
                    &times;
                  </button>
                </div>
              ))
            )}
          </div>
          <button
            onClick={addPreset}
            className="mt-4 w-full p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md"
          >
            + Add New Preset
          </button>
        </div>
        <div className="bg-gray-100 px-6 py-3 flex justify-end space-x-3 rounded-b-lg">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300"
          >
            {loading ? "Saving..." : "Save Presets"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditPresetsModal;
