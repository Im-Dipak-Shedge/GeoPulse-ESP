import connectDB from "./config.js";

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import DailyHistory from "./schemas/DailyHistory.js";

dotenv.config();

const app = express();

const PORT = 3000;

connectDB();

const ML_API_URL =
    process.env.ML_API_URL ||
    "http://127.0.0.1:5000";

const allowedOrigins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    process.env.CLIENT_URL,
];

app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error(`Not allowed by CORS: ${origin}`));
            }
        },
        credentials: true,
    })
);
app.use(express.json());


// ==========================================
// ROOT
// ==========================================

app.get("/", (req, res) => {
    res.json({
        message:
            "Driver Behavior Node API is running"
    });
});


// ==========================================
// LATEST LOCATION
// ==========================================

let latestLocation = null;

let latestPrediction = {
    behavior: "WAITING",
    confidence: 0,
    probabilities: {
        AGGRESSIVE: 0,
        NORMAL: 0,
        SLOW: 0
    }
};

// ==========================================
// ACTIVE ROUTE STATE / start route 
// ==========================================

let activeRoute = null;

const START_DISTANCE_METERS = 50;
const MIN_POINT_DISTANCE_METERS = 10;
const STOP_TIME_MS = 5 * 60 * 1000;



// ==========================================
// ML HEALTH
// ==========================================

app.get(
    "/api/driver-behavior/health",
    async (req, res) => {
        try {
            const response = await fetch(
                `${ML_API_URL}/health`
            );

            const data =
                await response.json();

            res.json({
                node: "ok",
                ml_api: data
            });

        } catch (error) {
            console.error(error);

            res.status(503).json({
                node: "ok",
                ml_api: "unavailable",
                error: error.message
            });
        }
    }
);


// ==========================================
// DRIVER BEHAVIOR PREDICTION
// ==========================================

app.post(
    "/api/driver-behavior/predict",
    async (req, res) => {

        try {

            const { readings } = req.body;


            if (!Array.isArray(readings)) {

                return res.status(400).json({
                    error:
                        "readings must be an array"
                });
            }

            if (readings.length < 25) {
                return res.status(400).json({
                    error:
                        "At least 25 readings are required",
                    received:
                        readings.length,
                    required: 25
                });
            }



            const response = await fetch(
                `${ML_API_URL}/predict`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        readings
                    })
                }
            );

            const data =
                await response.json();

            // Save latest prediction
            if (response.ok) {
                latestPrediction = data;
            }


            res.status(
                response.status
            ).json(data);

        } catch (error) {

            console.error(
                "ML prediction error:",
                error
            );

            res.status(500).json({
                error:
                    "Failed to connect to Flask ML API",
                details:
                    error.message
            });
        }
    }
);


// ==========================================
// BEHAVIOR PREDICTION FOR DASHBOARD
// ==========================================
app.get(
    "/api/driver-behavior/latest",
    (req, res) => {

        res.json(latestPrediction);

    }
);



function calculateDistance(
    lat1,
    lon1,
    lat2,
    lon2
) {
    const R = 6371; // Earth radius in km

    const dLat =
        ((lat2 - lat1) * Math.PI) / 180;

    const dLon =
        ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;

    const c =
        2 * Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );

    return R * c;
}


// gps → NODE
// app.post(
//     "/api/location",
//     (req, res) => {

//         try {

//             const {
//                 latitude,
//                 longitude,
//                 accuracy
//             } = req.body;

//             if (
//                 typeof latitude !==
//                 "number" ||
//                 typeof longitude !==
//                 "number"
//             ) {
//                 return res.status(400).json({
//                     error:
//                         "Invalid latitude or longitude"
//                 });
//             }

//             latestLocation = {

//                 latitude,

//                 longitude,

//                 accuracy:
//                     typeof accuracy ===
//                         "number"
//                         ? accuracy
//                         : null,

//                 timestamp:
//                     new Date().toISOString()
//             };

//             res.json({
//                 message:
//                     "Location updated",

//                 location:
//                     latestLocation
//             });

//         } catch (error) {

//             console.error(
//                 "Location error:",
//                 error
//             );

//             res.status(500).json({
//                 error:
//                     "Failed to update location"
//             });
//         }
//     }
// );


async function finishActiveRoute() {

    if (
        !activeRoute ||
        activeRoute.status !== "ACTIVE"
    ) {
        return;
    }

    const endTime = new Date();

    const endLocation = {
        latitude:
            activeRoute.lastLocation.latitude,

        longitude:
            activeRoute.lastLocation.longitude
    };


    // Duration in seconds
    const duration =
        Math.floor(
            (endTime.getTime() -
                activeRoute.startTime.getTime()) /
            1000
        );


    // ==========================================
    // TODAY'S DATE
    // ==========================================

    const date =
        endTime.toISOString().split("T")[0];


    // ==========================================
    // FIND TODAY'S HISTORY
    // ==========================================

    let dailyHistory =
        await DailyHistory.findOne({
            date
        });


    // ==========================================
    // CREATE NEW DAY
    // ==========================================

    if (!dailyHistory) {

        dailyHistory =
            new DailyHistory({
                date,
                totalDistance: 0,
                totalTravelTime: 0,
                routes: []
            });
    }


    // ==========================================
    // CREATE COMPLETED ROUTE
    // ==========================================

    const completedRoute = {

        routeId:
            activeRoute.routeId,

        startTime:
            activeRoute.startTime,

        endTime,

        startLocation:
            activeRoute.startLocation,

        endLocation,

        distance:
            activeRoute.distance,

        duration,

        points:
            activeRoute.points
    };


    // ==========================================
    // ADD ROUTE TO DAY
    // ==========================================

    dailyHistory.routes.push(
        completedRoute
    );


    // ==========================================
    // UPDATE DAILY TOTALS
    // ==========================================

    dailyHistory.totalDistance +=
        activeRoute.distance;

    dailyHistory.totalTravelTime +=
        duration;


    await dailyHistory.save();


    console.log(
        `🏁 Journey finished: ${activeRoute.routeId}`
    );

    console.log(
        `Distance: ${activeRoute.distance.toFixed(2)} km`
    );

    console.log(
        `Points: ${activeRoute.points.length}`
    );


    // ==========================================
    // RESET JOURNEY
    // ==========================================

    activeRoute = null;
}

app.post(
    "/api/location",
    async (req, res) => {
        try {
            const {
                latitude,
                longitude,
                accuracy
            } = req.body;

            if (
                typeof latitude !== "number" ||
                typeof longitude !== "number"
            ) {
                return res.status(400).json({
                    error:
                        "Invalid latitude or longitude"
                });
            }

            const now = new Date();

            // ==========================================
            // UPDATE LIVE LOCATION
            // ==========================================

            latestLocation = {
                latitude,
                longitude,
                accuracy:
                    typeof accuracy === "number"
                        ? accuracy
                        : null,
                timestamp: now.toISOString()
            };


            // ==========================================
            // NO ACTIVE ROUTE
            // ==========================================

            if (!activeRoute) {

                // Store first GPS position temporarily
                activeRoute = {
                    status: "WAITING",
                    firstLocation: {
                        latitude,
                        longitude
                    },
                    lastLocation: {
                        latitude,
                        longitude
                    },
                    lastMovementTime: now
                };

                return res.json({
                    message: "Location updated",
                    journey: "WAITING",
                    location: latestLocation
                });
            }


            // ==========================================
            // CALCULATE MOVEMENT
            // ==========================================

            const distanceKm =
                calculateDistance(
                    activeRoute.lastLocation.latitude,
                    activeRoute.lastLocation.longitude,
                    latitude,
                    longitude
                );

            const distanceMeters =
                distanceKm * 1000;


            // ==========================================
            // WAITING FOR VEHICLE TO MOVE
            // ==========================================

            if (
                activeRoute.status === "WAITING"
            ) {

                const fromStartKm =
                    calculateDistance(
                        activeRoute.firstLocation.latitude,
                        activeRoute.firstLocation.longitude,
                        latitude,
                        longitude
                    );

                const fromStartMeters =
                    fromStartKm * 1000;


                // Vehicle moved enough → START
                if (
                    fromStartMeters >=
                    START_DISTANCE_METERS
                ) {

                    const routeId =
                        `route_${Date.now()}`;

                    activeRoute = {
                        status: "ACTIVE",

                        routeId,

                        startTime: now,

                        startLocation: {
                            latitude:
                                activeRoute.firstLocation
                                    .latitude,
                            longitude:
                                activeRoute.firstLocation
                                    .longitude
                        },

                        endLocation: null,

                        distance: 0,

                        points: [
                            {
                                latitude:
                                    activeRoute.firstLocation
                                        .latitude,
                                longitude:
                                    activeRoute.firstLocation
                                        .longitude,
                                accuracy: null,
                                timestamp:
                                    activeRoute.lastMovementTime
                            }
                        ],

                        lastLocation: {
                            latitude,
                            longitude
                        },

                        lastMovementTime: now
                    };

                    console.log(
                        `🚗 Journey started: ${routeId}`
                    );
                }
            }


            // ==========================================
            // ACTIVE JOURNEY
            // ==========================================

            if (
                activeRoute.status === "ACTIVE"
            ) {

                // Only add meaningful GPS movement
                if (
                    distanceMeters >=
                    MIN_POINT_DISTANCE_METERS
                ) {

                    activeRoute.distance +=
                        distanceKm;

                    activeRoute.points.push({
                        latitude,
                        longitude,
                        accuracy:
                            typeof accuracy === "number"
                                ? accuracy
                                : null,
                        timestamp: now
                    });

                    activeRoute.lastLocation = {
                        latitude,
                        longitude
                    };

                    activeRoute.lastMovementTime =
                        now;
                }


                // ========================================
                // CHECK IF VEHICLE HAS STOPPED
                // ========================================

                const stoppedFor =
                    Date.now() -
                    activeRoute.lastMovementTime
                        .getTime();

                if (
                    stoppedFor >=
                    STOP_TIME_MS
                ) {

                    await finishActiveRoute();
                }
            }


            res.json({
                message: "Location updated",

                journey:
                    activeRoute?.status ||
                    "FINISHED",

                location:
                    latestLocation
            });

        } catch (error) {

            console.error(
                "Location error:",
                error
            );

            res.status(500).json({
                error:
                    "Failed to update location"
            });
        }
    }
);


// DASHBOARD → NODE
app.get(
    "/api/location/latest",
    (req, res) => {

        if (!latestLocation) {

            return res.status(404).json({
                error:
                    "No location available"
            });
        }

        const age =
            Date.now() -
            new Date(
                latestLocation.timestamp
            ).getTime();

        if (age > 20000) {

            return res.status(404).json({
                error:
                    "Phone GPS disconnected"
            });
        }

        res.json(
            latestLocation
        );
    }
);


// ==========================================
// ROUTE HISTORY - AVAILABLE DAYS
// ==========================================

app.get(
    "/api/history",
    async (req, res) => {

        try {

            const history = await DailyHistory
                .find({})
                .sort({ date: -1 })
                .select(
                    "date totalDistance totalTravelTime"
                );

            res.json(history);

        } catch (error) {

            console.error(
                "History fetch error:",
                error
            );

            res.status(500).json({
                error:
                    "Failed to fetch route history"
            });
        }
    }
);

// ==========================================
// ROUTE HISTORY - ONE DAY
// ==========================================

app.get(
    "/api/history/:date",
    async (req, res) => {

        try {

            const { date } = req.params;

            const history =
                await DailyHistory.findOne({
                    date
                });

            if (!history) {

                return res.status(404).json({
                    error:
                        "No history found for this date"
                });
            }

            res.json(history);

        } catch (error) {

            console.error(
                "Day history fetch error:",
                error
            );

            res.status(500).json({
                error:
                    "Failed to fetch day history"
            });
        }
    }
);

// ==========================================
// START SERVER
// ==========================================

if (process.env.NODE_ENV !== "production") {
    app.listen(PORT, "0.0.0.0", () => {
        console.log(`Node API running on port ${PORT}`);
        console.log(`ML API: ${ML_API_URL}`);
    });
}

export default app;