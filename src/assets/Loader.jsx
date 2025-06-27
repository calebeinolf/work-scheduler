import React from "react";

const Loader = ({ color = "black", width = 16 }) => (
  <svg
    className="animate-spin h-5 w-5 mr-2"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    width={width}
    height={width}
    viewBox="0 0 24 24"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke={color}
      strokeWidth="4"
    ></circle>
    <path
      className="opacity-75"
      fill={color}
      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
    ></path>
  </svg>
);

export default Loader;
