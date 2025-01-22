# import json
# file_path = "data.json"
# with open(file_path, "r") as file:
#     data = json.load(file)
# metrics_to_remove = {
#     'handwashing',
#     'walking_asymmetry_percentage',
#     'walking_step_length',
#     'walking_double_support_percentage'
# }
# data["data"]["metrics"] = [
#     metric for metric in data["data"]["metrics"] if metric["name"] not in metrics_to_remove
# ]
# with open(file_path, "w") as file:
#     json.dump(data, file, indent=4)


import json
file = "data.json"
with open(file, "r") as file:
    data = json.load(file)
metric_names = [metric["name"] for metric in data["data"]["metrics"]]
# hand washing , walking assymetry percentage , walking step length , walking double support percentage
print(metric_names)
