# Driver Behavior Detection — ML Model + API

An ML pipeline that classifies driving behavior (**SLOW / NORMAL / AGGRESSIVE**)
from accelerometer + gyroscope readings, served over a REST API for your
MERN frontend.

```
driver-behavior-ml/
├── model/
│   ├── training_data.csv        # your uploaded dataset
│   ├── train.py                 # trains + evaluates the Random Forest
│   ├── model.joblib              # trained model (generated)
│   ├── scaler.joblib             # feature scaler (generated)
│   ├── label_encoder.joblib      # class label mapping (generated)
│   ├── feature_columns.json      # exact feature order the model expects
│   └── metrics.json              # accuracy, F1, confusion matrix, importances
├── api/
│   ├── app.py                   # Flask inference API
│   └── requirements.txt
└── mern-integration/
    ├── driverBehaviorRoutes.js  # Express route that proxies to the Flask API
    └── useDriverBehavior.js     # React hook example (device motion -> API)
```

## 1. How the model works

Your CSV (`AccX, AccY, AccZ, GyroX, GyroY, GyroZ, Class, Timestamp`) turned out
to be **3 continuous recordings**, one per class (SLOW / NORMAL / AGGRESSIVE).
A single instantaneous reading is dominated by sensor noise/vibration and
isn't distinctive enough on its own — classifying raw rows tops out around
47% accuracy (barely above the 41% you'd get by always guessing "SLOW").

So the pipeline instead **slides a 25-sample window** over the raw stream and
computes summary statistics per window (mean, std, min, max, range for each
axis, plus acceleration/rotation magnitude and a jerk proxy) — this mirrors
exactly what your ESP8266 would buffer and send in real deployment. That
raised held-out (time-based, not shuffled) accuracy to **~55%** with macro-F1
**~0.52** on this dataset.

**Be upfront in your report/demo about the honest limitation:** with only one
recording session per class, this is a small dataset — the model is real and
usable but not highly confident on edge cases. The single highest-leverage
improvement is collecting **several separate driving sessions per class**
(different drivers, routes, times of day). More sessions → the model
generalizes instead of partly memorizing one drive's noise signature.

Feature importance shows lateral acceleration (`AccY`) and vertical
acceleration (`AccZ`) dominate — makes sense: aggressive driving shows up as
sharp lateral swings (turns/swerves) and vertical jolts (hard accel/braking),
while gyro axes matter less on this rig.

## 2. Run the model training

```bash
cd model
pip install -r ../api/requirements.txt
python train.py
```

Regenerates `model.joblib`, `scaler.joblib`, `label_encoder.joblib`,
`feature_columns.json`, `metrics.json`. Re-run any time you add more data to
`training_data.csv` (keep it as contiguous same-class blocks, or extend
`train.py` to read a `session_id` column if you record multiple drives).

## 3. Run the inference API

```bash
cd api
pip install -r requirements.txt
python app.py
# -> http://localhost:5000
```

For production, put it behind gunicorn instead of the dev server:
```bash
pip install gunicorn
gunicorn -w 2 -b 0.0.0.0:5000 app:app
```

### Endpoints

| Method | Path                        | Purpose |
|---|---|---|
| GET  | `/health`                  | liveness check |
| GET  | `/model-info`               | classes, accuracy, top features |
| POST | `/predict`                  | classify a batch window of readings |
| POST | `/predict/stream`            | feed one reading at a time (server buffers per `session_id`) |
| POST | `/predict/stream/reset`      | clear a session's buffer |

**`POST /predict`** body (needs ≥25 readings, oldest first):
```json
{
  "readings": [
    {"AccX": 0.12, "AccY": 0.05, "AccZ": 1.01, "GyroX": 0.0, "GyroY": 0.0, "GyroZ": 0.0},
    { "...": "24 more readings" }
  ]
}
```
Response:
```json
{
  "behavior": "AGGRESSIVE",
  "confidence": 0.85,
  "probabilities": {"AGGRESSIVE": 0.85, "NORMAL": 0.12, "SLOW": 0.03},
  "window_size_used": 25
}
```

**`POST /predict/stream`** body (call once per incoming sensor packet):
```json
{ "session_id": "car-1", "reading": {"AccX":0.1,"AccY":0.0,"AccZ":1.0,"GyroX":0.0,"GyroY":0.0,"GyroZ":0.0} }
```
Returns `{"ready": false, "buffered": 12, "needed": 25}` until the window
fills, then a prediction like `/predict`'s response.

## 4. Wire it into your MERN stack

You don't need to rewrite anything in Python on the frontend side — the
Express backend just proxies JSON to the Flask service:

1. Copy `mern-integration/driverBehaviorRoutes.js` into your Express app's
   `routes/` folder and mount it:
   ```js
   app.use('/api/driver-behavior', require('./routes/driverBehaviorRoutes'));
   ```
2. Set `ML_API_URL=http://localhost:5000` (or wherever you deploy the Flask
   service) in your Node backend's environment.
3. In React, either call `fetch('/api/driver-behavior/predict', ...)` directly,
   or start from `mern-integration/useDriverBehavior.js`, which buffers
   live readings and calls the streaming endpoint — swap its `devicemotion`
   listener for your actual ESP8266/WebSocket/MQTT feed.
4. (Optional) uncomment the Mongoose bits in `driverBehaviorRoutes.js` to log
   each prediction + GPS location/speed to MongoDB for an event-history view
   and map, matching the dashboard idea in your project doc.

## 5. Suggested demo flow

```
ESP8266 (ADXL345 + GPS) → Node/Express → Flask /predict/stream → React dashboard
```
Buffer 25 raw samples worth of time on the device or in Express, POST each
to `/stream`, and show the live `behavior` + `confidence` plus a running
event log (behavior, speed, GPS lat/lng, timestamp) — exactly the dashboard
sketched in your project brief.




to host a project temperary in cmd use claudeflared frontend: 

.\cloudflared.exe tunnel --url http://localhost:5173  use this tracker followed by route /gps



to host a project temperary in cmd use claudeflared backend : 

.\cloudflared.exe tunnel --url http://localhost:3000 addd this to .env in frontend as backendurl



## production 
# pythonml flask url - https://geopulse-esp-python-ml.vercel.app/
# node express url - https://geo-pulse-9mumyqaag-dipak-shedge-s-projects.vercel.app/

