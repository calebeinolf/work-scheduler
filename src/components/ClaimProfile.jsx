// src/components/ClaimProfile.jsx

import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "../firebase";

const ClaimProfile = () => {
  const [unclaimedProfiles, setUnclaimedProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();
  const companyId = location.state?.companyId;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        navigate("/login");
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (!companyId) {
      setError("No company information found. Please try joining again.");
      setLoading(false);
      return;
    }

    const fetchUnclaimedProfiles = async () => {
      try {
        // Query for profiles in the company that have not been claimed
        const profilesQuery = query(
          collection(db, "users"),
          where("companyId", "==", companyId),
          where("role", "==", "worker"),
          where("authUid", "==", null)
        );

        const querySnapshot = await getDocs(profilesQuery);
        const profiles = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setUnclaimedProfiles(profiles);
      } catch (err) {
        console.error("Error fetching profiles:", err);
        setError("Could not load worker profiles.");
      } finally {
        setLoading(false);
      }
    };

    fetchUnclaimedProfiles();
  }, [companyId]);

  const handleClaimProfile = async (profileId) => {
    if (!user) {
      setError("You are not signed in.");
      return;
    }

    try {
      // Update the selected profile to link it to the current user's auth account
      const profileDocRef = doc(db, "users", profileId);
      await updateDoc(profileDocRef, {
        authUid: user.uid,
        email: user.email,
      });
      navigate("/dashboard");
    } catch (err) {
      console.error("Error claiming profile:", err);
      setError("There was an error claiming this profile. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading profiles...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8">
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">
          Claim Your Profile
        </h2>
        <p className="text-center text-gray-500 text-sm mb-6">
          Select your name from the list below.
        </p>

        {error && (
          <p className="bg-red-100 text-red-700 p-3 rounded-md my-4 text-center">
            {error}
          </p>
        )}

        <div className="space-y-3">
          {unclaimedProfiles.length > 0 ? (
            unclaimedProfiles.map((profile) => (
              <button
                key={profile.id}
                onClick={() => handleClaimProfile(profile.id)}
                className="w-full text-left p-4 bg-gray-100 hover:bg-blue-100 rounded-lg transition"
              >
                <span className="font-semibold">{profile.fullName}</span>
                <span className="text-sm text-gray-600 ml-2">
                  ({profile.title})
                </span>
              </button>
            ))
          ) : (
            <p className="text-center text-gray-500">
              No unclaimed profiles found. Please contact your manager.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClaimProfile;
