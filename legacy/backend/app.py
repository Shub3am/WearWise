from flask import Flask, request, jsonify
from parameters_ml import get_key_metrics
from rag import generate_ai_report
from flask_cors import CORS, cross_origin


app = Flask(__name__)
CORS(app)
@app.post("/diagnose")

def diagnose():
    req_body = request.get_json()
    # print(list(req_body['symptoms']['symptoms']))
    if ("symptoms" in req_body and "watch_metrics" in req_body):
        health_data = (req_body["watch_metrics"])
        
        Vital_Metric_Model_ML = get_key_metrics(list(req_body["symptoms"]['symptoms']))
        report = generate_ai_report(Vital_Metric_Model_ML, health_data, list(req_body["symptoms"]['symptoms']))
        print(report)
        return jsonify(report)
    return jsonify( "Request Body Missing")




if __name__ == "__main__":
    app.run(debug=True, port=5000)