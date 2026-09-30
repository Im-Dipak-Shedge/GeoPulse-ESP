const express = require("express");
const router = express.Router();
const ML_API_URL = process.env.ML_API_URL || "http://127.0.0.1:5000";

// Test connection to Flask
router.get("/health", async (req, res) => {
    try {
        const response = await fetch(`${ML_API_URL}/health`);

        const data = await response.json();

        res.json({
            node: "ok",
            ml_api: data
        });
    } catch (error) {
        console.error("ML API health error:", error.message);

        res.status(503).json({
            node: "ok",
            ml_api: "unavailable",
            error: error.message
        });
    }
});

// Send multiple sensor readings to Flask
router.post("/predict", async (req, res) => {
    try {
        const { readings } = req.body;

        if (!Array.isArray(readings)) {
            return res.status(400).json({
                error: "readings must be an array"
            });
        }

        if (readings.length < 25) {
            return res.status(400).json({
                error: "At least 25 readings are required",
                received: readings.length,
                required: 25
            });
        }

        const response = await fetch(`${ML_API_URL}/predict`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                readings
            })
        });

        const data = await response.json();

        res.status(response.status).json(data);

    } catch (error) {
        console.error("Prediction error:", error.message);

        res.status(500).json({
            error: "Failed to connect to ML API",
            details: error.message
        });
    }
});

module.exports = router;