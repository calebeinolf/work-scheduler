// src/components/LandingPage.jsx

import React from "react";
import { Link } from "react-router-dom";

const LandingPage = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-xl text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">
          Welcome to the Scheduler
        </h1>
        <p className="text-gray-600 mb-10">
          The easiest way to manage your lifeguard schedule.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Create Company Card */}
          <Link
            to="/create-company"
            className="block p-8 bg-white rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
          >
            <h2 className="text-2xl font-bold text-blue-600">
              Create a Company
            </h2>
            <p className="mt-2 text-gray-500">
              For Head Guards and Managers. Set up your pool and start building
              your schedule.
            </p>
          </Link>

          {/* Join Company Card */}
          <Link
            to="/join-company"
            className="block p-8 bg-white rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
          >
            <h2 className="text-2xl font-bold text-green-600">
              Join a Company
            </h2>
            <p className="mt-2 text-gray-500">
              For Workers. Use your email and a company code to access your
              schedule.
            </p>
          </Link>
        </div>

        <div className="my-4 flex gap-2 justify-center items-center">
          <p className="text-gray-500">Already have an account?</p>
          <Link to="/login" className="font-medium text-blue-600">
            Login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
