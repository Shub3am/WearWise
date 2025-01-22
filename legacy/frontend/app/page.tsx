"use client";

import { useState } from "react";

export default function SymptomsQuestionnaire() {
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);

  const symptomCategories = {
    cardiorespiratory: {
      title: "Heart & Breathing",
      symptoms: [
        "Shortness of breath",
        "Rapid heartbeat",
        "Heart palpitations",
        "Chest discomfort",
        "Dizziness when standing",
        "Irregular heartbeat",
        "Difficulty breathing during light activity",
      ],
    },
    sleep: {
      title: "Sleep & Fatigue",
      symptoms: [
        "Difficulty falling asleep",
        "Waking up frequently",
        "Daytime sleepiness",
        "Fatigue",
        "Low energy levels",
        "Morning exhaustion",
        "Irregular sleep patterns",
      ],
    },
    activity: {
      title: "Physical Activity & Energy",
      symptoms: [
        "Reduced exercise tolerance",
        "Quick exhaustion during activities",
        "Weakness during daily tasks",
        "Post-activity fatigue",
        "Decreased stamina",
        "Difficulty climbing stairs",
      ],
    },
    general: {
      title: "General Health",
      symptoms: [
        "Fever or elevated body temperature",
        "Cold sweats",
        "Unexplained tiredness",
        "Loss of appetite",
        "Difficulty concentrating",
        "Light-headedness",
      ],
    },
  };

  const handleSymptomToggle = (symptom: string) => {
    setSelectedSymptoms((prev) => {
      if (prev.includes(symptom)) {
        return prev.filter((s) => s !== symptom);
      } else {
        return [...prev, symptom];
      }
    });
  };

  const handleSubmit = () => {
    console.log("Selected symptoms:", selectedSymptoms);
    // Here you would typically send the data to your backend
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-md overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">
            Health Symptoms Questionnaire
          </h2>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <p className="text-sm text-gray-500 mb-6">
            Please select any symptoms you are experiencing. This questionnaire
            focuses on symptoms that can be analyzed alongside your Apple Watch
            health data.
          </p>

          {/* Scrollable symptoms area */}
          <div className="h-[500px] overflow-y-auto pr-4">
            {Object.entries(symptomCategories).map(([key, category]) => (
              <div key={key} className="mb-8">
                <h3 className="text-lg font-semibold text-gray-700 mb-4">
                  {category.title}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {category.symptoms.map((symptom) => (
                    <div key={symptom} className="flex items-center space-x-3">
                      <div
                        onClick={() => handleSymptomToggle(symptom)}
                        className={`w-5 h-5 rounded border cursor-pointer flex items-center justify-center
                          ${
                            selectedSymptoms.includes(symptom)
                              ? "bg-blue-500 border-blue-500"
                              : "border-gray-300 hover:border-blue-500"
                          }`}>
                        {selectedSymptoms.includes(symptom) && (
                          <svg
                            className="w-3 h-3 text-white"
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                            stroke="currentColor">
                            <path d="M5 13l4 4L19 7"></path>
                          </svg>
                        )}
                      </div>
                      <label className="text-sm text-gray-700 cursor-pointer select-none">
                        {symptom}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Submit button */}
          <div className="mt-6">
            <button
              onClick={handleSubmit}
              disabled={selectedSymptoms.length === 0}
              className={`w-full py-2 px-4 rounded-md text-white text-sm font-medium
                ${
                  selectedSymptoms.length === 0
                    ? "bg-gray-300 cursor-not-allowed"
                    : "bg-blue-500 hover:bg-blue-600 transition-colors"
                }`}>
              Submit Symptoms ({selectedSymptoms.length} selected)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
