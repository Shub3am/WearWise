import json
import os
from config import Config
from langchain_groq import ChatGroq
from langchain.prompts import PromptTemplate
from langchain.chains import LLMChain

def create_medical_report(health_data, symptoms, metrics_list):
    os.environ["GROQ_API_KEY"] = Config.GROQ_AI_KEY
    llm = ChatGroq(
        model="mixtral-8x7b-32768",
        temperature=0.3,
        max_tokens=None,
        timeout=None,
        max_retries=2,
    )

    prompt_template = """
    You are a healthcare analytics expert. Generate a medical report based on the following data:
    Patient Symptoms: {symptoms}
    Health Metrics Data: {health_data}
    
    Generate a medical report that includes analysis of symptoms, patterns, and recommendations.
    Format your response as a JSON object with the following structure:
    {{
        "report_id": "unique_string",
        "timestamp": "current_datetime",
        "analysis": {{
            "symptom_analysis": "detailed analysis text",
            "metric_patterns": "patterns found in metrics",
            "concerns": ["list", "of", "concerns"]
        }},
        "recommendations": {{
            "monitoring": ["list", "of", "monitoring", "recommendations"],
            "follow_up": ["list", "of", "follow up", "actions"]
        }},
        "risk_level": "low|medium|high"
    }}
    Ensure the output is valid JSON.
    """
    
    prompt = PromptTemplate(
        template=prompt_template,
        input_variables=["symptoms", "health_data"]
    )
    chain = LLMChain(llm=llm, prompt=prompt)

    relevant_metrics = [
        metric for metric in health_data["data"]["metrics"] 
        if metric["name"] in metrics_list
    ]
    
    report = chain.run({
        "symptoms": json.dumps(symptoms),
        "health_data": json.dumps(relevant_metrics)
    })
    
    try:
        report_dict = json.loads(report)
        return json.dumps(report_dict, indent=2)
    except json.JSONDecodeError:
        fallback_report = {
            "report_id": "error_report",
            "timestamp": "",
            "analysis": {
                "symptom_analysis": "Error processing report",
                "metric_patterns": "Unable to analyze metrics",
                "concerns": ["Error in report generation"]
            },
            "recommendations": {
                "monitoring": ["Consult healthcare provider"],
                "follow_up": ["Schedule immediate appointment"]
            },
            "risk_level": "unknown"
        }
        return json.dumps(fallback_report, indent=2)

def main(metrics_list, health_data_json, selected_symptoms):
    try:
        health_data = json.loads(health_data_json)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON data: {e}")

    return create_medical_report(health_data, selected_symptoms, metrics_list)

if __name__ == "__main__":
    metrics = [
        "respiratory_rate",
        "heart_rate",
        "walking_heart_rate_average",
        "blood_oxygen_saturation",
        "sleep_analysis",
        "physical_effort",
        "resting_heart_rate"
    ]
    symptoms = ["Shortness of breath", "Fatigue", "Dizziness when standing"]
    
    try:
        with open('data.json', 'r') as f:
            health_data = f.read()
        
        report = main(metrics, health_data, symptoms)
        print(report)
    except FileNotFoundError:
        print(json.dumps({"error": "data.json file not found"}, indent=2))
    except ValueError as e:
        print(json.dumps({"error": str(e)}, indent=2))