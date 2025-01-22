from langchain.chains.llm import LLMChain
from langchain.prompts import PromptTemplate
from langchain_groq import ChatGroq
import json
import os
from config import Config

def initialize_llm():
    os.environ["GROQ_API_KEY"] = Config.GROQ_AI_KEY
    return ChatGroq(
        model="mixtral-8x7b-32768",
        temperature=0,
        max_tokens=None,
        timeout=None,
        max_retries=2,
    )

def create_prompt_template():
    prompt_template = """
    You are a health monitoring expert. Your task is to analyze the user's symptoms and provide only the relevant health parameters to monitor using wearable device data.
    Available Health Parameters:
    {health_parameters}
    Symptom Categories:
    {symptoms}
    Example 1:
    User Symptoms: ["Shortness of breath", "Fatigue"]
    Parameters: ["respiratory_rate", "heart_rate", "walking_heart_rate_average", "blood_oxygen_saturation", "sleep_analysis", "physical_effort", "active_energy"]
    Example 2:
    User Symptoms: ["Irregular sleep patterns", "Daytime sleepiness"]
    Parameters: ["sleep_analysis", "apple_sleeping_wrist_temperature", "time_in_daylight", "apple_stand_time", "physical_effort"]
    User's Selected Symptoms:
    {selected_symptoms}
    Return only a list of relevant parameter names, nothing else. Format the response as a JSON array.
    """
    return PromptTemplate(
        template=prompt_template,
        input_variables=[
            "health_parameters",
            "symptoms",
            "selected_symptoms"
        ]
    )

def init_llm_chain(llm, prompt_template):
    return LLMChain(llm=llm, prompt=prompt_template, verbose=True)

def main_return_function(selected_symptoms, health_parameters, symptoms):
    llm = initialize_llm()
    prompt_template = create_prompt_template()
    llm_chain = init_llm_chain(llm, prompt_template)

    response = llm_chain.invoke({
        "health_parameters": json.dumps(health_parameters, indent=2),
        "symptoms": json.dumps(symptoms, indent=2),
        "selected_symptoms": json.dumps(selected_symptoms, indent=2)
    })

    try:
        return json.loads(response['text'])
    except json.JSONDecodeError:
        import re
        array_match = re.search(r'\[(.*?)\]', response['text'])
        if array_match:
            params = [p.strip().strip('"\'') for p in array_match.group(1).split(',')]
            return params
        return []

def get_key_metrics(selected_symptoms):
    health_parameters = [
        'apple_exercise_time', 'walking_speed', 'apple_stand_hour',
        'basal_energy_burned', 'walking_heart_rate_average', 'heart_rate',
        'walking_running_distance', 'active_energy', 'flights_climbed',
        'apple_stand_time', 'step_count', 'blood_oxygen_saturation',
        'sleep_analysis', 'apple_sleeping_wrist_temperature', 'respiratory_rate',
        'time_in_daylight', 'resting_heart_rate', 'heart_rate_variability',
        'environmental_audio_exposure', 'headphone_audio_exposure', 'physical_effort'
    ]

    symptoms = {
        "cardiorespiratory": {
            "title": "Heart & Breathing",
            "symptoms": [
                "Shortness of breath", "Rapid heartbeat", "Heart palpitations",
                "Chest discomfort", "Dizziness when standing", "Irregular heartbeat",
                "Difficulty breathing during light activity"
            ]
        },
        "sleep": {
            "title": "Sleep & Fatigue",
            "symptoms": [
                "Difficulty falling asleep", "Waking up frequently",
                "Daytime sleepiness", "Fatigue", "Low energy levels",
                "Morning exhaustion", "Irregular sleep patterns"
            ]
        },
        "activity": {
            "title": "Physical Activity & Energy",
            "symptoms": [
                "Reduced exercise tolerance", "Quick exhaustion during activities",
                "Weakness during daily tasks", "Post-activity fatigue",
                "Decreased stamina", "Difficulty climbing stairs"
            ]
        },
        "general": {
            "title": "General Health",
            "symptoms": [
                "Fever or elevated body temperature", "Cold sweats",
                "Unexplained tiredness", "Loss of appetite",
                "Difficulty concentrating", "Light-headedness"
            ]
        }
    }

    try:
        return main_return_function(
            selected_symptoms,
            health_parameters,
            symptoms
        )
    except Exception as e:
        return []

if __name__ == "__main__":
    test_symptoms = ["Shortness of breath", "Fatigue", "Dizziness when standin"]
    results = get_key_metrics(test_symptoms)
    print(json.dumps(results, indent=2))