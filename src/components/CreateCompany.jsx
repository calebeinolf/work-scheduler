// src/components/CreateCompany.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { addDoc, collection, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase'; // Make sure this path is correct

const CreateCompany = () => {
  const [companyName, setCompanyName] = useState('');
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  
  const navigate = useNavigate();

  // Effect to get the current logged-in user
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        navigate('/login');
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  /**
   * Generates a random alphanumeric string to be used as a join code.
   * @param {number} length - The desired length of the code.
   * @returns {string} The generated random code.
   */
  const generateJoinCode = (length = 6) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  /**
   * Handles the form submission to create a new company.
   * @param {React.FormEvent} e - The form submission event.
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      setError("You must be logged in to create a company.");
      return;
    }
    setLoading(true);
    setError('');

    try {
      // 1. Generate a unique join code
      const newJoinCode = generateJoinCode();
      
      // 2. Create a new document in the 'companies' collection
      const companyCollectionRef = collection(db, 'companies');
      const companyDocRef = await addDoc(companyCollectionRef, {
        name: companyName,
        ownerId: user.uid,
        joinCode: newJoinCode,
        createdAt: serverTimestamp(),
      });

      // 3. Update the manager's user document with the new company ID
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        companyId: companyDocRef.id,
      });

      // 4. Set the join code in state to display it
      setJoinCode(newJoinCode);

    } catch (err) {
      setError("Failed to create company. Please try again.");
      console.error("Error creating company:", err);
      setLoading(false);
    }
    // No longer loading after success or failure
    setLoading(false);
  };

  // If a join code has been generated, show the success screen
  if (joinCode) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8 text-center">
                <h2 className="text-2xl font-bold text-green-600 mb-4">Company Created!</h2>
                <p className="text-gray-600 mb-2">Share this code with your workers to let them join:</p>
                <div className="bg-gray-100 p-4 rounded-lg mb-6">
                    <p className="text-3xl font-bold text-gray-800 tracking-widest">{joinCode}</p>
                </div>
                <button
                    onClick={() => navigate('/dashboard')}
                    className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                >
                    Go to Dashboard
                </button>
            </div>
        </div>
    );
  }

  // Otherwise, show the creation form
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8">
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">Create Your Company</h2>
        {error && <p className="bg-red-100 text-red-700 p-3 rounded-md mb-4 text-center">{error}</p>}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="companyName" className="block text-gray-700 text-sm font-bold mb-2">
              Company Name
            </label>
            <input
              type="text"
              id="companyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Sunnyvale Community Pool"
            />
          </div>
          <div className="flex items-center justify-between">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-blue-300"
            >
              {loading ? 'Creating...' : 'Create Company'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateCompany;
