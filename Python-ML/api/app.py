

"""
Driver Behavior Detection - Inference API
-------------------------------------------
Flask REST API for the trained Random Forest model.

The trained model uses ONLY:
    AccX
    AccY
    AccZ

No gyroscope data is required.

Run:
    py -3.13 app.py

Server:
    http://localhost:5000

Endpoints:
    GET  /health
    GET  /model-info
    POST /predict
    POST /predict/stream
    POST /predict/stream/reset
"""

import json
from pathlib import Path
from collections import deque, defaultdict

import numpy as np
import joblib
from flask import Flask, request, jsonify


# ============================================================
# PATHS
# ============================================================

HERE = Path(__file__).parent
MODEL_DIR = HERE.parent / "model"

app = Flask(__name__)


# ============================================================
# CORS
# ============================================================

@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    return response


@app.route("/<path:_any>", methods=["OPTIONS"])
def cors_preflight(_any):
    return "", 204


# ============================================================
# LOAD TRAINED MODEL
# ============================================================

model = joblib.load(MODEL_DIR / "model.joblib")
scaler = joblib.load(MODEL_DIR / "scaler.joblib")
label_encoder = joblib.load(MODEL_DIR / "label_encoder.joblib")

with open(MODEL_DIR / "feature_columns.json") as f:
    FEATURE_COLUMNS = json.load(f)

with open(MODEL_DIR / "metrics.json") as f:
    METRICS = json.load(f)


# ============================================================
# MODEL SETTINGS
# ============================================================

WINDOW_SIZE = METRICS["window_size"]

# IMPORTANT:
# The trained model uses acceleration ONLY.
RAW_COLUMNS = ["AccX", "AccY", "AccZ"]


# ============================================================
# STREAMING BUFFER
# ============================================================

SESSION_BUFFERS = defaultdict(
    lambda: deque(maxlen=WINDOW_SIZE)
)


# ============================================================
# FEATURE EXTRACTION
# ============================================================

def readings_to_feature_row(readings: list[dict]) -> np.ndarray:
    """
    Convert raw acceleration readings into the exact
    21 features used during model training.

    Input:
        [
            {"AccX": ..., "AccY": ..., "AccZ": ...},
            ...
        ]

    Features:
        AccX_mean
        AccX_std
        AccX_min
        AccX_max
        AccX_range

        AccY_mean
        AccY_std
        AccY_min
        AccY_max
        AccY_range

        AccZ_mean
        AccZ_std
        AccZ_min
        AccZ_max
        AccZ_range

        AccMag_mean
        AccMag_std
        AccMag_min
        AccMag_max
        AccMag_range

        AccMag_jerk
    """

    # Use the most recent 25 readings
    window = readings[-WINDOW_SIZE:]

    # --------------------------------------------------------
    # Convert acceleration values to NumPy arrays
    # --------------------------------------------------------

    arr = {
        col: np.array(
            [float(r[col]) for r in window],
            dtype=float
        )
        for col in RAW_COLUMNS
    }

    # --------------------------------------------------------
    # Calculate acceleration magnitude
    # Same calculation used during training
    # --------------------------------------------------------

    arr["AccMag"] = np.sqrt(
        arr["AccX"] ** 2
        + arr["AccY"] ** 2
        + arr["AccZ"] ** 2
    )

    # --------------------------------------------------------
    # Generate features
    # --------------------------------------------------------

    feat = {}

    for col in ["AccX", "AccY", "AccZ", "AccMag"]:

        vals = arr[col]

        feat[f"{col}_mean"] = vals.mean()
        feat[f"{col}_std"] = vals.std()
        feat[f"{col}_min"] = vals.min()
        feat[f"{col}_max"] = vals.max()
        feat[f"{col}_range"] = vals.max() - vals.min()

    # --------------------------------------------------------
    # Acceleration jerk
    # Same feature used during training
    # --------------------------------------------------------

    feat["AccMag_jerk"] = np.abs(
        np.diff(arr["AccMag"])
    ).mean()

    # --------------------------------------------------------
    # IMPORTANT:
    # Arrange features in exactly the same order as training
    # --------------------------------------------------------

    row = np.array([
        [feat[column] for column in FEATURE_COLUMNS]
    ])

    return row


# ============================================================
# PREDICTION
# ============================================================

def predict_from_readings(readings: list[dict]):

    # Create 21-feature row
    row = readings_to_feature_row(readings)

    # Apply the same scaler used during training
    row_scaled = scaler.transform(row)

    # Random Forest prediction
    pred_idx = model.predict(row_scaled)[0]

    # Prediction probabilities
    proba = model.predict_proba(row_scaled)[0]

    # Convert encoded prediction back to class name
    label = label_encoder.inverse_transform(
        [pred_idx]
    )[0]

    probabilities = {
        cls: float(prob)
        for cls, prob in zip(
            label_encoder.classes_,
            proba
        )
    }

    confidence = max(probabilities.values())

    return label, probabilities, confidence


# ============================================================
# VALIDATION
# ============================================================

def validate_readings(readings):

    if not isinstance(readings, list):
        return "`readings` must be a list of sensor reading objects"

    if len(readings) < WINDOW_SIZE:
        return (
            f"Need at least {WINDOW_SIZE} readings, "
            f"got {len(readings)}"
        )

    for index, reading in enumerate(readings):

        if not isinstance(reading, dict):
            return f"Reading {index} must be an object"

        for column in RAW_COLUMNS:

            if column not in reading:
                return (
                    f"Reading {index} is missing "
                    f"field '{column}'"
                )

            try:
                float(reading[column])
            except (TypeError, ValueError):
                return (
                    f"Reading {index} field "
                    f"'{column}' must be numeric"
                )

    return None


# ============================================================
# HEALTH
# ============================================================

@app.route("/health", methods=["GET"])
def health():

    return jsonify({
        "status": "ok",
        "model_loaded": True,
        "window_size": WINDOW_SIZE,
        "sensor": "ADXL345",
        "axes": RAW_COLUMNS
    })


# ============================================================
# MODEL INFORMATION
# ============================================================

@app.route("/model-info", methods=["GET"])
def model_info():

    return jsonify({
        "classes": METRICS["classes"],
        "window_size": WINDOW_SIZE,
        "raw_input_fields": RAW_COLUMNS,
        "feature_count": len(FEATURE_COLUMNS),
        "features": FEATURE_COLUMNS,
        "test_accuracy": METRICS["test_accuracy"],
        "test_macro_f1": METRICS["test_macro_f1"],
        "top_features": dict(
            list(
                METRICS["feature_importances"].items()
            )[:8]
        )
    })


# ============================================================
# NORMAL PREDICTION
# ============================================================

@app.route("/predict", methods=["POST"])
def predict():

    """
    Request:

    {
        "readings": [
            {
                "AccX": 0.10,
                "AccY": 0.20,
                "AccZ": 0.90
            },
            ...
        ]
    }

    At least 25 readings are required.
    """

    data = request.get_json(silent=True) or {}

    readings = data.get("readings")

    error = validate_readings(readings)

    if error:
        return jsonify({
            "error": error
        }), 400

    try:

        label, probabilities, confidence = (
            predict_from_readings(readings)
        )

    except Exception as e:

        return jsonify({
            "error": f"Prediction failed: {str(e)}"
        }), 500

    return jsonify({

        "behavior": label,

        "probabilities": probabilities,

        "confidence": confidence,

        "window_size_used": min(
            len(readings),
            WINDOW_SIZE
        ),

        "features_used": len(FEATURE_COLUMNS),

        "sensor": "ADXL345",

        "axes": RAW_COLUMNS
    })


# ============================================================
# STREAMING PREDICTION
# ============================================================

@app.route("/predict/stream", methods=["POST"])
def predict_stream():

    """
    Feed one acceleration reading at a time.

    Request:

    {
        "session_id": "car-1",

        "reading": {
            "AccX": 0.10,
            "AccY": 0.20,
            "AccZ": 0.90
        }
    }

    A prediction is returned after 25 readings.
    """

    data = request.get_json(silent=True) or {}

    session_id = data.get(
        "session_id",
        "default"
    )

    reading = data.get("reading")

    # --------------------------------------------------------
    # Validate reading
    # --------------------------------------------------------

    if not isinstance(reading, dict):

        return jsonify({
            "error": "`reading` must be an object"
        }), 400

    for column in RAW_COLUMNS:

        if column not in reading:

            return jsonify({
                "error": (
                    f"`reading` must include "
                    f"field '{column}'"
                )
            }), 400

        try:
            float(reading[column])
        except (TypeError, ValueError):

            return jsonify({
                "error": (
                    f"'{column}' must be numeric"
                )
            }), 400

    # --------------------------------------------------------
    # Add reading to session buffer
    # --------------------------------------------------------

    buf = SESSION_BUFFERS[session_id]

    buf.append(reading)

    # --------------------------------------------------------
    # Not enough readings yet
    # --------------------------------------------------------

    if len(buf) < WINDOW_SIZE:

        return jsonify({

            "ready": False,

            "buffered": len(buf),

            "needed": WINDOW_SIZE - len(buf),

            "window_size": WINDOW_SIZE
        })

    # --------------------------------------------------------
    # Predict
    # --------------------------------------------------------

    try:

        label, probabilities, confidence = (
            predict_from_readings(
                list(buf)
            )
        )

    except Exception as e:

        return jsonify({
            "error": f"Prediction failed: {str(e)}"
        }), 500

    return jsonify({

        "ready": True,

        "behavior": label,

        "probabilities": probabilities,

        "confidence": confidence,

        "buffered": len(buf),

        "window_size": WINDOW_SIZE
    })


# ============================================================
# RESET STREAM
# ============================================================

@app.route("/predict/stream/reset", methods=["POST"])
def reset_stream():

    data = request.get_json(silent=True) or {}

    session_id = data.get(
        "session_id",
        "default"
    )

    SESSION_BUFFERS.pop(
        session_id,
        None
    )

    return jsonify({

        "reset": True,

        "session_id": session_id
    })


# ============================================================
# START SERVER
# ============================================================

if __name__ == "__main__":

    print(
        f"Model classes: {METRICS['classes']}"
    )

    print(
        f"Window size  : {WINDOW_SIZE}"
    )

    print(
        f"Features     : {len(FEATURE_COLUMNS)}"
    )

    print(
        f"Input fields : {RAW_COLUMNS}"
    )

    app.run(
        host="0.0.0.0",
        port=5000,
        debug=False
    )

