  import { useEffect, useState } from "react";
  import {
    MapContainer,
    TileLayer,
    Marker,
    Popup,
    Polyline,
    useMap,
  } from "react-leaflet";
  import L from "leaflet";
  import "leaflet/dist/leaflet.css";
  import "./index.css";

  // Fix Leaflet marker icons in Vite
  delete L.Icon.Default.prototype._getIconUrl;

  L.Icon.Default.mergeOptions({
    iconRetinaUrl:
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl:
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl:
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });

  // function MapUpdater({
  //   location,
  //   selectedRoute,
  //   selectedDay,
  //   showAllRoutes,
  //   showRoutes,
  // }) {
  //   const map = useMap();

  //   useEffect(() => {

  //     // ==========================================
  //     // SHOW ALL HISTORICAL ROUTES
  //     // ==========================================

  //     if (
  //       showRoutes &&
  //       showAllRoutes &&
  //       selectedDay?.routes?.length > 0
  //     ) {
  //       const coordinates =
  //         selectedDay.routes.flatMap(
  //           (route) =>
  //             (route.points || []).map((point) => [
  //               point.latitude,
  //               point.longitude,
  //             ])
  //         );

  //       if (coordinates.length > 0) {
  //         map.fitBounds(coordinates, {
  //           padding: [50, 50],
  //         });

  //         return;
  //       }
  //     }


  //     // ==========================================
  //     // SHOW SELECTED HISTORICAL ROUTE
  //     // ==========================================

  //     if (
  //       showRoutes &&
  //       selectedRoute?.points?.length > 0
  //     ) {
  //       const coordinates =
  //         selectedRoute.points.map((point) => [
  //           point.latitude,
  //           point.longitude,
  //         ]);

  //       map.fitBounds(coordinates, {
  //         padding: [50, 50],
  //       });

  //       return;
  //     }


  //     // ==========================================
  //     // OTHERWISE SHOW LIVE LOCATION
  //     // ==========================================

  //     if (location) {
  //       map.setView(
  //         [
  //           location.latitude,
  //           location.longitude,
  //         ],
  //         16
  //       );
  //     }

  //   }, [
  //     location,
  //     selectedRoute,
  //     selectedDay,
  //     showAllRoutes,
  //     showRoutes,
  //     map,
  //   ]);

  //   return null;
  // }


  function MapUpdater({
  location,
  selectedRoute,
  selectedDay,
  showAllRoutes,
  showRoutes,
}) {
  const map = useMap();

  useEffect(() => {
    // ==========================================
    // HISTORICAL ROUTES
    // ==========================================

    if (showRoutes) {
      // Show all routes
      if (
        showAllRoutes &&
        selectedDay?.routes?.length > 0
      ) {
        const coordinates = selectedDay.routes.flatMap(
          (route) =>
            (route.points || []).map((point) => [
              point.latitude,
              point.longitude,
            ])
        );

        if (coordinates.length > 0) {
          map.fitBounds(coordinates, {
            padding: [50, 50],
          });

          return;
        }
      }

      // Show selected route
      if (
        selectedRoute?.points?.length > 0
      ) {
        const coordinates =
          selectedRoute.points.map((point) => [
            point.latitude,
            point.longitude,
          ]);

        map.fitBounds(coordinates, {
          padding: [50, 50],
        });

        return;
      }
    }

    // ==========================================
    // LIVE LOCATION
    // ==========================================

    if (!showRoutes && location) {
      map.setView(
        [
          location.latitude,
          location.longitude,
        ],
        16
      );
    }
  }, [
    location,
    selectedRoute,
    selectedDay,
    showAllRoutes,
    showRoutes,
    map,
  ]);

  return null;
}
  function App() {
    // ==========================================
    // LIVE LOCATION
    // ==========================================

    const [location, setLocation] = useState(null);
    const [locationError, setLocationError] = useState("");

    // ==========================================
    // ML BEHAVIOR
    // ==========================================

    const [behavior, setBehavior] = useState("WAITING");
    const [confidence, setConfidence] = useState(0);

    const [probabilities, setProbabilities] = useState({
      AGGRESSIVE: 0,
      NORMAL: 0,
      SLOW: 0,
    });

    // ==========================================
    // ROUTE HISTORY
    // ==========================================

    const [showHistory, setShowHistory] = useState(false);

    const [historyDays, setHistoryDays] = useState([]);

    const [selectedDate, setSelectedDate] = useState(null);

    const [selectedDay, setSelectedDay] = useState(null);

  const [selectedRoute, setSelectedRoute] = useState(null);

  const [showAllRoutes, setShowAllRoutes] = useState(false);

  const [showRoutes, setShowRoutes] = useState(false);

    const [historyLoading, setHistoryLoading] = useState(false);

    const [historyError, setHistoryError] = useState("");

    const NODE_API = import.meta.env.VITE_BACKEND_URL;

    // ==========================================
    // GET GPS LOCATION FROM NODE
    // ==========================================

useEffect(() => {
  const fetchLocation = async () => {
    try {
      const response = await fetch(
        `${NODE_API}/api/location/latest`
      );

      if (!response.ok) {
        console.warn("No live location available");
        return;
      }

      const data = await response.json();

      setLocation({
        latitude: data.latitude,
        longitude: data.longitude,
        accuracy: data.accuracy,
      });

      setLocationError("");
    } catch (error) {
      console.error("Location fetch error:", error);
      setLocationError("GPS disconnected");
    }
  };

  fetchLocation();

  const interval = setInterval(fetchLocation, 2000);

  return () => clearInterval(interval);
}, [NODE_API]);

    // ==========================================
    // REALTIME ML PREDICTION
    // ==========================================

    useEffect(() => {
      const fetchPrediction = async () => {
        try {
          const response = await fetch(
            `${NODE_API}/api/driver-behavior/latest`
          );

          if (!response.ok) {
            throw new Error(
              "Prediction unavailable"
            );
          }

          const data = await response.json();

          setBehavior(data.behavior);
          setConfidence(data.confidence);
          setProbabilities(data.probabilities);
        } catch (error) {
          console.error(
            "Prediction fetch error:",
            error
          );
        }
      };

      fetchPrediction();

      const interval = setInterval(
        fetchPrediction,
        2000
      );

      return () => clearInterval(interval);
    }, []);

    // ==========================================
    // LOAD AVAILABLE HISTORY DAYS
    // ==========================================

    const loadHistory = async () => {
      try {
        setHistoryLoading(true);
        setHistoryError("");

        const response = await fetch(
          `${NODE_API}/api/history`
        );

        if (!response.ok) {
          throw new Error(
            "Failed to load route history"
          );
        }

        const data = await response.json();

        /*
          Supports either:

          [
            {
              date: "2026-09-26",
              totalDistance: 23.4,
              totalTravelTime: 5400
            }
          ]

          OR:

          {
            history: [...]
          }
        */

        const history = Array.isArray(data)
          ? data
          : data.history || [];

        setHistoryDays(history);

        // Automatically select the first day
        if (history.length > 0) {
          const firstDate =
            history[0].date;

          setSelectedDate(firstDate);

          await loadDayHistory(firstDate);
        }
      } catch (error) {
        console.error(
          "History fetch error:",
          error
        );

        setHistoryError(
          "Unable to load route history"
        );
      } finally {
        setHistoryLoading(false);
      }
    };

    // ==========================================
    // LOAD ONE DAY'S HISTORY
    // ==========================================

    const loadDayHistory = async (date) => {
      try {
        setHistoryLoading(true);
        setHistoryError("");

        const response = await fetch(
          `${NODE_API}/api/history/${date}`
        );

        if (!response.ok) {
          throw new Error(
            "Failed to load selected day"
          );
        }

        const data = await response.json();

        /*
          Expected:

          {
            date: "2026-09-26",
            totalDistance: 23.4,
            totalTravelTime: 5400,
            routes: [...]
          }
        */

        setSelectedDay(data);

        // Clear previous selected route
        setSelectedRoute(null);
        setShowAllRoutes(false);
        setShowRoutes(false);
      } catch (error) {
        console.error(
          "Day history fetch error:",
          error
        );

        setHistoryError(
          "Unable to load routes for this date"
        );
      } finally {
        setHistoryLoading(false);
      }
    };

    // ==========================================
    // OPEN HISTORY PANEL
    // ==========================================

    const openHistory = async () => {
      setShowHistory(true);

      /*
        Only load history when opening
        the panel.
      */
      if (historyDays.length === 0) {
        await loadHistory();
      }
    };

    // ==========================================
    // SELECT ROUTE
    // ==========================================

  const handleRouteSelect = (route) => {
    setSelectedRoute(route);
    setShowAllRoutes(false);
    setShowRoutes(true);
  };

  // ==========================================
  // SHOW LIVE LOCATION
  // ==========================================

 const handleShowLiveLocation = () => {
  setSelectedRoute(null);
  setShowAllRoutes(false);
  setShowRoutes(false);
  setLocationError("");
};

    // ==========================================
    // CLOSE HISTORY PANEL
    // ==========================================

    const closeHistory = () => {
      setShowHistory(false);
    };

    // ==========================================
    // MAP CENTER
    // ==========================================

    const mapCenter = location
      ? [
          location.latitude,
          location.longitude,
        ]
      : [19.076, 72.8777];


    return (
      <div className="min-h-screen bg-slate-950 text-white">

        {/* ==========================================
            HEADER
        ========================================== */}

        <header className="border-b border-slate-800 bg-slate-900">
          <div className="mx-auto max-w-7xl px-6 py-5">

            <div className="flex items-center justify-between">

              {/* Title */}

              <div>
                <h1 className="text-2xl font-bold">
                  Driver Behavior Monitor
                </h1>

                <p className="mt-1 text-sm text-slate-400">
                  Real-time behavior and location
                  tracking
                </p>
              </div>

              {/* Header Buttons */}

              <div className="flex items-center gap-5">

                {/* Route History Button */}

                <button
                  onClick={openHistory}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
                >
                  Route History
                </button>

                {/* Live Status */}

                <div className="flex items-center gap-2">

                  <span className="h-3 w-3 rounded-full bg-green-500"></span>

                  <span className="text-sm text-green-400">
                    LIVE
                  </span>

                </div>

              </div>

            </div>

          </div>
        </header>

        {/* ==========================================
            DASHBOARD
        ========================================== */}

        <main className="mx-auto max-w-7xl p-6">

          {/* ==========================================
              TOP CARDS
          ========================================== */}

          <div className="grid gap-6 lg:grid-cols-3">

            {/* ==========================================
                BEHAVIOR
            ========================================== */}

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

              <p className="text-sm text-slate-400">
                Current Behavior
              </p>

              <h2
                className={`mt-4 text-4xl font-bold ${
                  behavior === "AGGRESSIVE"
                    ? "text-red-500"
                    : behavior === "NORMAL"
                    ? "text-green-400"
                    : behavior === "SLOW"
                    ? "text-blue-400"
                    : "text-slate-400"
                }`}
              >
                {behavior}
              </h2>

              <p className="mt-3 text-slate-400">
                Confidence:{" "}
                {(confidence * 100).toFixed(2)}%
              </p>

            </div>

            {/* ==========================================
                PROBABILITIES
            ========================================== */}

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

              <p className="text-sm text-slate-400">
                Prediction Probability
              </p>

              <div className="mt-5 space-y-4">

                {/* Aggressive */}

                <div>

                  <div className="mb-1 flex justify-between text-sm">

                    <span>
                      AGGRESSIVE
                    </span>

                    <span>
                      {(
                        probabilities.AGGRESSIVE *
                        100
                      ).toFixed(1)}
                      %
                    </span>

                  </div>

                  <div className="h-2 rounded-full bg-slate-800">

                    <div
                      className="h-2 rounded-full bg-red-500"
                      style={{
                        width: `${
                          probabilities.AGGRESSIVE *
                          100
                        }%`,
                      }}
                    />

                  </div>

                </div>

                {/* Normal */}

                <div>

                  <div className="mb-1 flex justify-between text-sm">

                    <span>
                      NORMAL
                    </span>

                    <span>
                      {(
                        probabilities.NORMAL *
                        100
                      ).toFixed(1)}
                      %
                    </span>

                  </div>

                  <div className="h-2 rounded-full bg-slate-800">

                    <div
                      className="h-2 rounded-full bg-green-500"
                      style={{
                        width: `${
                          probabilities.NORMAL *
                          100
                        }%`,
                      }}
                    />

                  </div>

                </div>

                {/* Slow */}

                <div>

                  <div className="mb-1 flex justify-between text-sm">

                    <span>
                      SLOW
                    </span>

                    <span>
                      {(
                        probabilities.SLOW *
                        100
                      ).toFixed(1)}
                      %
                    </span>

                  </div>

                  <div className="h-2 rounded-full bg-slate-800">

                    <div
                      className="h-2 rounded-full bg-blue-500"
                      style={{
                        width: `${
                          probabilities.SLOW *
                          100
                        }%`,
                      }}
                    />

                  </div>

                </div>

              </div>

            </div>

            {/* ==========================================
                GPS INFO
            ========================================== */}

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">

              <p className="text-sm text-slate-400">
                GPS Status
              </p>

              {location ? (

                <div className="mt-5 space-y-3">

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
                      {location.accuracy !== null
                        ? `${location.accuracy.toFixed(
                            1
                          )} m`
                        : "N/A"}
                    </p>

                  </div>

                  <p className="text-sm text-green-400">
                    ● GPS Connected
                  </p>

                </div>

              ) : (

                <p className="mt-5 text-yellow-400">
                  {locationError ||
                    "Waiting for GPS..."}
                </p>

              )}

            </div>

          </div>

          {/* ==========================================
              MAP
          ========================================== */}

          <div className="relative mt-6 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">

            {/* Map Header */}

            <div className="border-b border-slate-800 p-5">

              <div className="flex items-center justify-between">

                <div>

                  <h2 className="text-lg font-semibold">
                    Live Driver Location
                  </h2>

                  <p className="mt-1 text-sm text-slate-400">
                    Real-time GPS position
                  </p>

                </div>

                {/* Selected Route Indicator */}

                {selectedRoute && (
                  <div className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm">

                    Viewing:{" "}
                    <span className="font-semibold">
                      {selectedRoute.routeId}
                    </span>

                  </div>
                )}

              </div>

            </div>

            {/* ==========================================
                MAP
            ========================================== */}

            <div className="h-[500px]">

              <MapContainer
                center={mapCenter}
                zoom={16}
                scrollWheelZoom={true}
                className="h-full w-full"
              >

                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

  <MapUpdater
    location={location}
    selectedRoute={selectedRoute}
    selectedDay={selectedDay}
    showAllRoutes={showAllRoutes}
    showRoutes={showRoutes}
  />

  {/* ==========================================
      HISTORICAL ROUTES
  ========================================== */}

  {showRoutes &&
    (showAllRoutes
      ? selectedDay?.routes?.map((route, index) => {
          const coordinates =
            route.points?.map((point) => [
              point.latitude,
              point.longitude,
            ]) || [];

          if (coordinates.length === 0) {
            return null;
          }

          const routeColors = [
            "red",
            "blue",
            "lime",
            "orange",
            "purple",
            "cyan",
            "magenta",
            "yellow",
          ];

          return (
            <Polyline
              key={route.routeId || index}
              positions={coordinates}
              pathOptions={{
                color:
                  routeColors[
                    index % routeColors.length
                  ],
                weight: 5,
                opacity: 0.8,
              }}
            />
          );
        })
      : selectedRoute?.points?.length > 0 && (
          <Polyline
            positions={selectedRoute.points.map(
              (point) => [
                point.latitude,
                point.longitude,
              ]
            )}
            pathOptions={{
              color: "red",
              weight: 5,
              opacity: 0.8,
            }}
          />
        ))}

                {/* ==========================================
                    LIVE DRIVER MARKER
                ========================================== */}

                {location && (

                  <Marker
                    position={[
                      location.latitude,
                      location.longitude,
                    ]}
                  >

                    <Popup>

                      <strong>
                        Driver Location
                      </strong>

                      <br />

                      Behavior: {behavior}

                      <br />

                      Accuracy:{" "}

                      {location.accuracy !== null
                        ? `${location.accuracy.toFixed(
                            1
                          )} m`
                        : "N/A"}

                    </Popup>

                  </Marker>

                )}

              </MapContainer>

            </div>

            {/* ==========================================
                ROUTE HISTORY OVERLAY
            ========================================== */}

            {showHistory && (

              <div className="absolute right-5 top-5 z-[1000] w-[360px] max-w-[calc(100%-40px)]">

                <div className="max-h-[460px] overflow-hidden rounded-2xl border border-slate-700 bg-slate-950/95 shadow-2xl backdrop-blur">

                  {/* ==========================================
                      OVERLAY HEADER
                  ========================================== */}

                  <div className="flex items-center justify-between border-b border-slate-800 p-4">

                    <div>

                      <h3 className="font-semibold">
                        Route History
                      </h3>

                      <p className="mt-1 text-xs text-slate-500">
                        Select a previous route
                      </p>

                    </div>

                    <button
                      onClick={closeHistory}
                      className="rounded-lg px-3 py-1 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                    >
                      ✕
                    </button>

                  </div>

                  {/* ==========================================
                      HISTORY CONTENT
                  ========================================== */}

                  <div className="max-h-[390px] overflow-y-auto p-4">

                    {historyLoading && (

                      <div className="py-8 text-center text-sm text-slate-400">
                        Loading route history...
                      </div>

                    )}

                    {historyError && (

                      <div className="rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-400">
                        {historyError}
                      </div>

                    )}

                    {!historyLoading &&
                      !historyError &&
                      historyDays.length === 0 && (

                        <div className="py-8 text-center text-sm text-slate-500">
                          No route history available.
                        </div>

                      )}

                    {/* ==========================================
                        DATE LIST
                    ========================================== */}

                    {!historyLoading &&
                      historyDays.length > 0 && (

                        <div className="space-y-4">

                          <div>

                            <label className="mb-2 block text-xs font-medium text-slate-500">
                              SELECT DATE
                            </label>

                            <select
                              value={
                                selectedDate || ""
                              }
                              onChange={(event) => {
                                const date =
                                  event.target
                                    .value;

                                setSelectedDate(
                                  date
                                );

                                loadDayHistory(
                                  date
                                );
                              }}
                              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-slate-500"
                            >

                              {historyDays.map(
                                (day) => (

                                  <option
                                    key={
                                      day.date
                                    }
                                    value={
                                      day.date
                                    }
                                  >
                                    {day.date}
                                  </option>

                                )
                              )}

                            </select>

                          </div>

                          {/* ==========================================
                              DAY SUMMARY
                          ========================================== */}

                          {selectedDay && (

                            <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">

                              <div className="grid grid-cols-2 gap-3">

                                <div>

                                  <p className="text-xs text-slate-500">
                                    TOTAL DISTANCE
                                  </p>

                                  <p className="mt-1 font-semibold">
                                    {selectedDay.totalDistance?.toFixed(
                                      2
                                    ) || "0.00"}{" "}
                                    km
                                  </p>

                                </div>

                                <div>

                                  <p className="text-xs text-slate-500">
                                    ROUTES
                                  </p>

                                  <p className="mt-1 font-semibold">
                                    {selectedDay
                                      .routes
                                      ?.length ||
                                      0}
                                  </p>

                                </div>

                              </div>

                            </div>

                          )}

                          {/* ==========================================
                              ROUTE LIST
                          ========================================== */}

                          {selectedDay?.routes
                            ?.length > 0 ? (

                            <div>

                              <p className="mb-2 text-xs font-medium text-slate-500">
                                ROUTES
                              </p>
  <button
    onClick={handleShowLiveLocation}
    className={`mb-2 w-full rounded-xl border p-3 text-left transition ${
      !showRoutes
        ? "border-green-700 bg-green-950/30"
        : "border-slate-800 bg-slate-900 hover:border-slate-700 hover:bg-slate-800"
    }`}
  >
    <div className="flex items-center justify-between">
      <span className="font-medium">
        Live Location
      </span>

      <span className="text-xs text-green-400">
        ● LIVE
      </span>
    </div>

    <p className="mt-1 text-xs text-slate-500">
      Hide routes and return to current location
    </p>
  </button>
                              <button
    onClick={() => {
    setSelectedRoute(null);
    setShowAllRoutes(true);
    setShowRoutes(true);
  }}
    className={`mb-2 w-full rounded-xl border p-3 text-left transition ${
      showAllRoutes
        ? "border-slate-500 bg-slate-800"
        : "border-slate-800 bg-slate-900 hover:border-slate-700 hover:bg-slate-800"
    }`}
  >
    <div className="flex items-center justify-between">
      <span className="font-medium">
        Show All Routes
      </span>

      <span className="text-xs text-slate-500">
        {selectedDay?.routes?.length || 0} routes
      </span>
    </div>

    <p className="mt-1 text-xs text-slate-500">
      Display all routes on the map
    </p>
  </button>

                              <div className="space-y-2">

                                {selectedDay.routes.map(
                                  (
                                    route,
                                    index
                                  ) => {

                                    const isSelected =
                                      selectedRoute?.routeId ===
                                      route.routeId;

                                    return (

                                      <button
                                        key={
                                          route.routeId ||
                                          index
                                        }
                                        onClick={() =>
                                          handleRouteSelect(
                                            route
                                          )
                                        }
                                        className={`w-full rounded-xl border p-3 text-left transition ${
                                          isSelected
                                            ? "border-slate-500 bg-slate-800"
                                            : "border-slate-800 bg-slate-900 hover:border-slate-700 hover:bg-slate-800"
                                        }`}
                                      >

                                        <div className="flex items-center justify-between">

                                          <span className="font-medium">
                                            Route{" "}
                                            {index +
                                              1}
                                          </span>

                                          <span className="text-xs text-slate-500">
                                            {
                                              route.routeId
                                            }
                                          </span>

                                        </div>

                                        <div className="mt-3 grid grid-cols-2 gap-2">

                                          <div>

                                            <p className="text-xs text-slate-500">
                                              DISTANCE
                                            </p>

                                            <p className="text-sm">
                                              {route.distance?.toFixed(
                                                2
                                              ) ||
                                                "0.00"}{" "}
                                              km
                                            </p>

                                          </div>

                                          <div>

                                            <p className="text-xs text-slate-500">
                                              POINTS
                                            </p>

                                            <p className="text-sm">
                                              {route
                                                .points
                                                ?.length ||
                                                0}
                                            </p>

                                          </div>

                                        </div>

                                        <div className="mt-3">

                                          <p className="text-xs text-slate-500">
                                            TIME
                                          </p>

                                          <p className="text-sm">

                                            {route.startTime
                                              ? new Date(
                                                  route.startTime
                                                ).toLocaleTimeString(
                                                  [],
                                                  {
                                                    hour:
                                                      "2-digit",
                                                    minute:
                                                      "2-digit",
                                                  }
                                                )
                                              : "--:--"}

                                            {" → "}

                                            {route.endTime
                                              ? new Date(
                                                  route.endTime
                                                ).toLocaleTimeString(
                                                  [],
                                                  {
                                                    hour:
                                                      "2-digit",
                                                    minute:
                                                      "2-digit",
                                                  }
                                                )
                                              : "Ongoing"}

                                          </p>

                                        </div>

                                      </button>

                                    );
                                  }
                                )}

                              </div>

                            </div>

                          ) : (

                            selectedDay && (
                              <div className="py-6 text-center text-sm text-slate-500">
                                No routes recorded
                                for this date.
                              </div>
                            )

                          )}

                        </div>

                      )}

                  </div>

                </div>

              </div>

            )}

          </div>

        </main>

      </div>
    );
  }

  export default App;