// src/components/HomePage.jsx
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import Loader from "../assets/Loader";

const HomePage = () => {
  // Add state to track the user's authentication status.
  // 'loading' is the initial state before Firebase check is complete.
  const [authStatus, setAuthStatus] = useState("loading");

  useEffect(() => {
    // onAuthStateChanged is the Firebase listener that tells us
    // if a user is logged in or not.
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // If a user object exists, they are logged in.
        setAuthStatus("loggedIn");
      } else {
        // If no user, they are logged out.
        setAuthStatus("loggedOut");
      }
    });

    // Cleanup the listener when the component unmounts
    return () => unsubscribe();
  }, []); // The empty array ensures this effect runs only once.

  // Determine where the "Log In" button should lead.
  const loginDestination = authStatus === "loggedIn" ? "/schedule" : "/login";

  return (
    <div className="min-h-screen ">
      <div className="relative isolate px-6 pt-14 lg:px-8">
        <div
          className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
          aria-hidden="true"
        >
          <div
            className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#80dfff] to-[#0077be] opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
            style={{
              clipPath:
                "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
            }}
          ></div>
        </div>
        <div className="mx-auto flex items-center justify-center py-10 sm:py-16 lg:py-24">
          <div className="text-center w-fit">
            <h1 className="w-fit text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              When Do I Guard?
            </h1>
            <div className="mt-10 flex flex-col items-center justify-center gap-4">
              <Link
                to={loginDestination}
                // Disable the button while we check the auth status
                aria-disabled={authStatus === "loading"}
                className={`rounded-md w-full bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors ${
                  authStatus === "loading"
                    ? "bg-gray-400 cursor-not-allowed"
                    : "hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                }`}
              >
                {/* Change button text based on auth status */}
                {authStatus === "loggedIn" ? (
                  "Go to Dashboard"
                ) : authStatus === "loading" ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader color={"white"} />
                    Checking...
                  </div>
                ) : (
                  "Log In"
                )}
              </Link>
              <Link
                to="/signup"
                className="rounded-md w-full bg-white px-4 py-2.5 text-sm font-semibold shadow-sm hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                Sign Up <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
