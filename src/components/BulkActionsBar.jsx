// src/components/BulkActionsBar.jsx

import React from "react";
import {
  Printer,
  Undo2,
  Redo2,
  Send,
  EyeOff,
  CloudUpload,
  Ellipsis,
} from "lucide-react";

const BulkActionsBar = ({
  selectedWorkers,
  handleBulkUpdate,
  handleBulkRemove,
  handleUndo,
  handleRedo,
  canUndo,
  canRedo,
  onPrint,
  isPublished,
  hasUnpublishedChanges,
  onPublish,
  onUnpublish,
  onPublishChanges,
}) => {
  const [showMenu, setShowMenu] = React.useState(false);
  const menuRef = React.useRef(null);

  React.useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener("mousedown", handleClick);
    }
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showMenu]);

  // Tooltip state for Undo/Redo
  const [undoTooltip, setUndoTooltip] = React.useState(false);
  const [redoTooltip, setRedoTooltip] = React.useState(false);
  const undoTimeout = React.useRef();
  const redoTimeout = React.useRef();

  // Tooltip handlers
  const handleUndoMouseEnter = () => {
    undoTimeout.current = setTimeout(() => setUndoTooltip(true), 600);
  };
  const handleUndoMouseLeave = () => {
    clearTimeout(undoTimeout.current);
    setUndoTooltip(false);
  };
  const handleRedoMouseEnter = () => {
    redoTimeout.current = setTimeout(() => setRedoTooltip(true), 600);
  };
  const handleRedoMouseLeave = () => {
    clearTimeout(redoTimeout.current);
    setRedoTooltip(false);
  };

  return (
    <div
      className={`rounded-tl-lg border-t border-x rounded-tr-lg p-2 flex items-center justify-between bg-gray-500`}
    >
      <div className="flex-1">
        {selectedWorkers.length > 0 ? (
          <span className={`ml-1 text-white`}>
            {selectedWorkers.length} worker(s) selected
          </span>
        ) : (
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={handleUndo}
                disabled={!canUndo}
                className={`flex items-center justify-center gap-1 px-2 h-7 text-sm rounded-md bg-white disabled:opacity-50 ${
                  canUndo ? "hover:bg-gray-100" : "!cursor-default"
                }`}
                onMouseEnter={handleUndoMouseEnter}
                onMouseLeave={handleUndoMouseLeave}
              >
                <Undo2 width={15} /> Undo
              </button>
              {undoTooltip && (
                <div className="absolute left-1/2 -translate-x-1/2 -top-8 bg-gray-800 text-white text-xs rounded px-2 py-1 z-50 whitespace-nowrap pointer-events-none">
                  Ctrl+Z
                </div>
              )}
            </div>
            <div className="relative">
              <button
                onClick={handleRedo}
                disabled={!canRedo}
                className={`flex items-center justify-center gap-1 px-2 h-7 text-sm rounded-md bg-white disabled:opacity-50 ${
                  canRedo ? "hover:bg-gray-100" : "!cursor-default"
                }`}
                onMouseEnter={handleRedoMouseEnter}
                onMouseLeave={handleRedoMouseLeave}
              >
                Redo <Redo2 width={15} />
              </button>
              {redoTooltip && (
                <div className="absolute left-1/2 -translate-x-1/2 -top-8 bg-gray-800 text-white text-xs rounded px-2 py-1 z-50 whitespace-nowrap pointer-events-none">
                  Ctrl+Shift+Z
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 relative">
        {selectedWorkers.length > 0 ? (
          <>
            <button
              onClick={() => handleBulkUpdate([{ type: "OFF" }])}
              className="px-3 h-7 text-sm rounded-md bg-white text-red-500 hover:bg-red-100"
            >
              Set as OFF
            </button>
            <button
              onClick={() => handleBulkUpdate(null)}
              className="px-3 h-7 text-sm rounded-md bg-white hover:bg-gray-100"
            >
              Reset Shifts
            </button>
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMenu((v) => !v)}
                className="w-7 h-7 flex items-center justify-center rounded-md bg-white hover:bg-gray-100"
              >
                <Ellipsis width={16} />
              </button>
              {showMenu && (
                <div className="absolute right-0 mt-2 w-min bg-white border rounded shadow-lg z-50">
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      handleBulkRemove();
                    }}
                    className="block w-full rounded-sm text-nowrap text-sm text-left p-2 text-red-600 hover:bg-red-50"
                  >
                    Remove worker(s)
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <button
              onClick={onPrint}
              className="flex items-center justify-center gap-1 px-2 h-7 text-sm rounded-md bg-white"
            >
              <Printer width={15} /> Print
            </button>
            {!isPublished ? (
              <button
                onClick={onPublish}
                className="flex items-center justify-center gap-1 px-2 h-7 text-sm rounded-md bg-green-600 text-white hover:bg-green-700"
              >
                <Send width={15} /> Publish
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={onPublishChanges}
                  disabled={!hasUnpublishedChanges}
                  className={`flex items-center justify-center gap-1 px-2 h-7 text-sm rounded-md bg-blue-500 text-white  disabled:opacity-50 disabled:!cursor-default ${
                    hasUnpublishedChanges ? "hover:bg-blue-600" : ""
                  }`}
                >
                  <CloudUpload width={15} /> Publish Changes
                </button>
                <button
                  onClick={onUnpublish}
                  className="flex items-center justify-center gap-1 px-2 h-7 text-sm rounded-md bg-gray-600 text-white hover:bg-gray-700"
                >
                  <EyeOff width={15} /> Unpublish
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default BulkActionsBar;
