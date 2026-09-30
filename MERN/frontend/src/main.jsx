import { StrictMode } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import GPSTracker from "./components/GPSTracker.jsx";



createRoot(document.getElementById("root")).render(
  <StrictMode>
 <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/gps" element={<GPSTracker />} />
      
      </Routes>
    </BrowserRouter>
  </StrictMode>
);