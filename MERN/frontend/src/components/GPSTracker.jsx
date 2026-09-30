import { useEffect, useRef, useState } from "react";

const NODE_API = import.meta.env.VITE_BACKEND_URL;


function GPSTracker() {
    // =========================
    // GPS STATE
    // =========================

    const [location, setLocation] = useState(null);
    const [gpsStatus, setGpsStatus] =
        useState("Waiting for GPS...");

    // =========================
    // SENSOR STATE
    // =========================

    const [sensorData, setSensorData] = useState(null);
    const [sensorStatus, setSensorStatus] =
        useState("Waiting for motion sensor...");

    const [readingCount, setReadingCount] =
        useState(0);

    // =========================
    // ML STATE
    // =========================

    const [behavior, setBehavior] =
        useState("WAITING");

    const [confidence, setConfidence] =
        useState(0);

    const [probabilities, setProbabilities] =
        useState({
            AGGRESSIVE: 0,
            NORMAL: 0,
            SLOW: 0,
        });

    // =========================
    // SENSOR BUFFER
    // =========================

    const readingsRef = useRef([]);

    // =========================
    // GPS
    // =========================

    useEffect(() => {
        if (!navigator.geolocation) {
            setGpsStatus(
                "Geolocation is not supported"
            );

            return;
        }

        const watchId =
            navigator.geolocation.watchPosition(
                async (position) => {
                    const {
                        latitude,
                        longitude,
                        accuracy,
                    } = position.coords;

                    const newLocation = {
                        latitude,
                        longitude,
                        accuracy,
                    };

                    setLocation(newLocation);

                    setGpsStatus(
                        "GPS Connected"
                    );

                    try {
                        const response =
                            await fetch(
                                `${NODE_API}/api/location`,
                                {
                                    method: "POST",

                                    headers: {
                                        "Content-Type":
                                            "application/json",
                                    },

                                    body: JSON.stringify(
                                        newLocation
                                    ),
                                }
                            );

                        if (!response.ok) {
                            throw new Error(
                                "Failed to send location"
                            );
                        }

                        
                    } catch (error) {
                        console.error(
                            "Location upload error:",
                            error
                        );

                        setGpsStatus(
                            "GPS detected, but upload failed"
                        );
                    }
                },

                (error) => {
                    console.error(
                        "GPS error:",
                        error
                    );

                    setGpsStatus(
                        `GPS error: ${error.message}`
                    );
                },

                {
                    enableHighAccuracy: true,
                    maximumAge: 2000,
                    timeout: 10000,
                }
            );

        return () => {
            navigator.geolocation.clearWatch(
                watchId
            );
        };
    }, []);

    // =========================
    // ACCELEROMETER
    // =========================

    useEffect(() => {
        const handleMotion = async (event) => {
            const acc = event.acceleration;

            if (!acc) {
                setSensorStatus(
                    "Acceleration data unavailable"
                );

                return;
            }

            const reading = {
                AccX: acc.x ?? 0,
                AccY: acc.y ?? 0,
                AccZ: acc.z ?? 0,
            };

            // Show latest sensor values
            setSensorData(reading);

            setSensorStatus(
                "Motion Sensor Active"
            );

            // Add reading to ML buffer
            readingsRef.current.push(
                reading
            );

            const currentCount =
                readingsRef.current.length;

            setReadingCount(
                currentCount
            );

           

            // =========================
            // 25 READING ML WINDOW
            // =========================

            if (currentCount >= 25) {
                const readings =
                    readingsRef.current.slice(
                        0,
                        25
                    );

                // Clear buffer for next window
                readingsRef.current = [];

                setReadingCount(0);

                await sendReadings(
                    readings
                );
            }
        };

        window.addEventListener(
            "devicemotion",
            handleMotion
        );

        return () => {
            window.removeEventListener(
                "devicemotion",
                handleMotion
            );
        };
    }, []);

    // =========================
    // SEND SENSOR DATA TO NODE
    // =========================

    const sendReadings = async (
        readings
    ) => {
        try {
            
            const response =
                await fetch(
                    `${NODE_API}/api/driver-behavior/predict`,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json",
                        },

                        body: JSON.stringify({
                            readings,
                        }),
                    }
                );

            const data =
                await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error ||
                        "Prediction failed"
                );
            }

        
            // Update ML result
            setBehavior(
                data.behavior
            );

            setConfidence(
                data.confidence
            );

            if (data.probabilities) {
                setProbabilities(
                    data.probabilities
                );
            }
        } catch (error) {
            console.error(
                "ML prediction error:",
                error
            );
        }
    };

    // =========================
    // UI
    // =========================

    return (
        <div className="min-h-screen bg-slate-950 text-white p-6">
            <div className="mx-auto max-w-xl">

                {/* HEADER */}

                <div>
                    <h1 className="text-3xl font-bold">
                        Driver Device
                    </h1>

                    <p className="mt-2 text-slate-400">
                        GPS and driver behavior monitoring
                    </p>
                </div>

                {/* GPS */}

                <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">

                    <div className="flex items-center justify-between">

                        <h2 className="text-lg font-semibold">
                            GPS
                        </h2>

                        <span
                            className={
                                location
                                    ? "text-green-400"
                                    : "text-yellow-400"
                            }
                        >
                            ●{" "}
                            {location
                                ? "CONNECTED"
                                : "WAITING"}
                        </span>

                    </div>

                    <p className="mt-4 text-sm text-slate-400">
                        {gpsStatus}
                    </p>

                    {location && (
                        <div className="mt-5 space-y-4">

                            <div>
                                <p className="text-xs text-slate-500">
                                    LATITUDE
                                </p>

                                <p className="font-mono">
                                    {location.latitude.toFixed(
                                        6
                                    )}
                                </p>
                            </div>

                            <div>
                                <p className="text-xs text-slate-500">
                                    LONGITUDE
                                </p>

                                <p className="font-mono">
                                    {location.longitude.toFixed(
                                        6
                                    )}
                                </p>
                            </div>

                            <div>
                                <p className="text-xs text-slate-500">
                                    ACCURACY
                                </p>

                                <p>
                                    {location.accuracy !==
                                    null
                                        ? `${location.accuracy.toFixed(
                                              1
                                          )} m`
                                        : "N/A"}
                                </p>
                            </div>

                        </div>
                    )}

                </div>

                {/* MOTION SENSOR */}

                <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">

                    <div className="flex items-center justify-between">

                        <h2 className="text-lg font-semibold">
                            Motion Sensor
                        </h2>

                        <span
                            className={
                                sensorData
                                    ? "text-green-400"
                                    : "text-yellow-400"
                            }
                        >
                            ●{" "}
                            {sensorData
                                ? "ACTIVE"
                                : "WAITING"}
                        </span>

                    </div>

                    <p className="mt-4 text-sm text-slate-400">
                        {sensorStatus}
                    </p>

                    {sensorData && (
                        <div className="mt-5 grid grid-cols-3 gap-3">

                            <div className="rounded-xl bg-slate-800 p-4">

                                <p className="text-xs text-slate-400">
                                    AccX
                                </p>

                                <p className="mt-2 font-mono text-lg">
                                    {sensorData.AccX.toFixed(
                                        4
                                    )}
                                </p>

                            </div>

                            <div className="rounded-xl bg-slate-800 p-4">

                                <p className="text-xs text-slate-400">
                                    AccY
                                </p>

                                <p className="mt-2 font-mono text-lg">
                                    {sensorData.AccY.toFixed(
                                        4
                                    )}
                                </p>

                            </div>

                            <div className="rounded-xl bg-slate-800 p-4">

                                <p className="text-xs text-slate-400">
                                    AccZ
                                </p>

                                <p className="mt-2 font-mono text-lg">
                                    {sensorData.AccZ.toFixed(
                                        4
                                    )}
                                </p>

                            </div>

                        </div>
                    )}

                </div>

                {/* ML WINDOW */}

                <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">

                    <p className="text-sm text-slate-400">
                        ML Reading Window
                    </p>

                    <div className="mt-3 flex items-end justify-between">

                        <p className="text-3xl font-bold">
                            {readingCount}
                            <span className="text-slate-500">
                                {" "}
                                / 25
                            </span>
                        </p>

                        <p className="text-sm text-slate-400">
                            readings
                        </p>

                    </div>

                    <div className="mt-4 h-2 rounded-full bg-slate-800">

                        <div
                            className="h-2 rounded-full bg-blue-500 transition-all"
                            style={{
                                width: `${
                                    (readingCount /
                                        25) *
                                    100
                                }%`,
                            }}
                        />

                    </div>

                </div>

                {/* BEHAVIOR */}

                <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">

                    <p className="text-sm text-slate-400">
                        Current Behavior
                    </p>

                    <h2
                        className={`mt-3 text-4xl font-bold ${
                            behavior ===
                            "AGGRESSIVE"
                                ? "text-red-500"
                                : behavior ===
                                  "NORMAL"
                                ? "text-green-400"
                                : behavior ===
                                  "SLOW"
                                ? "text-blue-400"
                                : "text-slate-400"
                        }`}
                    >
                        {behavior}
                    </h2>

                    {behavior !==
                        "WAITING" && (
                        <p className="mt-3 text-slate-400">
                            Confidence:{" "}
                            {(
                                confidence *
                                100
                            ).toFixed(2)}
                            %
                        </p>
                    )}

                </div>

                {/* PROBABILITIES */}

                <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">

                    <p className="text-sm text-slate-400">
                        Prediction Probability
                    </p>

                    <div className="mt-5 space-y-5">

                        {/* AGGRESSIVE */}

                        <div>

                            <div className="flex justify-between text-sm">

                                <span>
                                    AGGRESSIVE
                                </span>

                                <span>
                                    {(
                                        probabilities
                                            .AGGRESSIVE *
                                        100
                                    ).toFixed(
                                        1
                                    )}
                                    %
                                </span>

                            </div>

                            <div className="mt-2 h-2 rounded-full bg-slate-800">

                                <div
                                    className="h-2 rounded-full bg-red-500 transition-all"
                                    style={{
                                        width: `${
                                            probabilities
                                                .AGGRESSIVE *
                                            100
                                        }%`,
                                    }}
                                />

                            </div>

                        </div>

                        {/* NORMAL */}

                        <div>

                            <div className="flex justify-between text-sm">

                                <span>
                                    NORMAL
                                </span>

                                <span>
                                    {(
                                        probabilities
                                            .NORMAL *
                                        100
                                    ).toFixed(
                                        1
                                    )}
                                    %
                                </span>

                            </div>

                            <div className="mt-2 h-2 rounded-full bg-slate-800">

                                <div
                                    className="h-2 rounded-full bg-green-500 transition-all"
                                    style={{
                                        width: `${
                                            probabilities
                                                .NORMAL *
                                            100
                                        }%`,
                                    }}
                                />

                            </div>

                        </div>

                        {/* SLOW */}

                        <div>

                            <div className="flex justify-between text-sm">

                                <span>
                                    SLOW
                                </span>

                                <span>
                                    {(
                                        probabilities
                                            .SLOW *
                                        100
                                    ).toFixed(
                                        1
                                    )}
                                    %
                                </span>

                            </div>

                            <div className="mt-2 h-2 rounded-full bg-slate-800">

                                <div
                                    className="h-2 rounded-full bg-blue-500 transition-all"
                                    style={{
                                        width: `${
                                            probabilities
                                                .SLOW *
                                            100
                                        }%`,
                                    }}
                                />

                            </div>

                        </div>

                    </div>

                </div>

            </div>
        </div>
    );
}

export default GPSTracker;