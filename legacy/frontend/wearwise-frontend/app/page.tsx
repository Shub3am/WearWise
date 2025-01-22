import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const SymptomsQuestionnaire = () => {
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);

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

  const handleSymptomToggle = (symptom) => {
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
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Health Symptoms Questionnaire</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-gray-500 mb-4">
          Please select any symptoms you are experiencing. This questionnaire
          focuses on symptoms that can be analyzed alongside your Apple Watch
          health data.
        </div>
        <ScrollArea className="h-[500px] pr-4">
          {Object.entries(symptomCategories).map(([key, category]) => (
            <div key={key} className="mb-6">
              <h3 className="text-lg font-semibold mb-3">{category.title}</h3>
              <div className="grid grid-cols-2 gap-4">
                {category.symptoms.map((symptom) => (
                  <div key={symptom} className="flex items-center space-x-2">
                    <Checkbox
                      id={symptom}
                      checked={selectedSymptoms.includes(symptom)}
                      onCheckedChange={() => handleSymptomToggle(symptom)}
                    />
                    <label
                      htmlFor={symptom}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      {symptom}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </ScrollArea>
        <div className="mt-6">
          <Button
            onClick={handleSubmit}
            className="w-full"
            disabled={selectedSymptoms.length === 0}>
            Submit Symptoms ({selectedSymptoms.length} selected)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default SymptomsQuestionnaire;
