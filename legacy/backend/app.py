from flask import Flask, request

app = Flask(__name__)

@app.post("/diagnose")
def diagnose():
    req_body = request.get_json()
    if ("symptoms" in req_body and "watch_metrics" in req_body):
        return "Welcome"
    return "Request Body Missing"




if __name__ == "__main__":
    Flask.run(app, debug=True)