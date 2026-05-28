import React, { useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import "./Globe.css";

gsap.registerPlugin(useGSAP);

export default function Globe() {
  const globeRef = useRef(null);
  const sliderRef = useRef(null);
  const [selectedLocation, setSelectedLocation] = useState(null);

  const locations = [
    {
      id: "vit-chennai",
      name: "VIT Chennai",
      // Point precisely to VIT Chennai (12.8406, 80.1533) on the East Coast
      // Adjusted left by 0.4% from 72.6% to 72.2%
      left: "70.2%",
      top: "43.1%",
      mapSrc:
        "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3890.3159938833917!2d80.1533094!3d12.8406259!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3a5259af8e491f67%3A0x944b42131b757d2d!2sVellore%20Institute%20of%20Technology%20-%20VIT%20Chennai!5e0!3m2!1sen!2sin!4v1716911684347!5m2!1sen!2sin",
      googleMapsUrl:
        "https://www.google.com/maps/search/VIT+Chennai,+Chennai,+Tamil+Nadu,+India/@12.8406259,80.1533094,17z",
    },
  ];

  const globalBranches = [
    // India
    { id: "vlr", left: "72.0%", top: "43.5%" }, // Vellore
    { id: "trc", left: "71.8%", top: "44.2%" }, // Trichy
    { id: "khp", left: "74.5%", top: "41.0%" }, // Kharagpur
    { id: "hyd", left: "71.5%", top: "42.5%" }, // Hyderabad
    { id: "delhi", left: "70.8%", top: "38.5%" }, // Delhi
    { id: "kozh", left: "70.5%", top: "44.0%" }, // Kozhikode
    { id: "mani", left: "70.0%", top: "43.8%" }, // Manipal
    { id: "pune", left: "69.5%", top: "42.0%" }, // Pune
    // UK
    { id: "cam", left: "49.5%", top: "28.5%" }, // Cambridge
    { id: "edi", left: "49.0%", top: "27.5%" }, // Edinburgh
    { id: "lon", left: "49.6%", top: "29.2%" }, // London
    { id: "war", left: "49.2%", top: "29.0%" }, // Warwick
    // US
    { id: "pri", left: "26.5%", top: "34.5%" }, // Princeton/NJ
    { id: "bos", left: "27.2%", top: "33.8%" }, // Boston
    // USC/UCI (CA)
    { id: "vir", left: "25.8%", top: "35.5%" }, // Virginia
    // Canada
    { id: "tor", left: "25.5%", top: "33.0%" }, // Toronto
    { id: "alb", left: "17.0%", top: "30.0%" }, // Alberta
    // Australia
    { id: "mel", left: "86.5%", top: "58.5%" }, // Melbourne
    { id: "ade", left: "85.0%", top: "57.5%" }, // Adelaide
    // Europe
    { id: "ber", left: "52.5%", top: "29.5%" }, // Berlin
    { id: "par", left: "50.5%", top: "30.5%" }, // Paris
    { id: "ams", left: "50.8%", top: "29.8%" }, // Netherlands
    { id: "sto", left: "54.0%", top: "26.5%" }, // Stockholm/Lund
    { id: "hel", left: "56.5%", top: "26.0%" }, // Helsinki
    { id: "swi", left: "51.5%", top: "31.5%" }, // Switzerland
    { id: "cop", left: "52.5%", top: "28.5%" }, // Copenhagen
    { id: "bar", left: "50.5%", top: "33.5%" }, // Barcelona
    // Asia
    { id: "sgp", left: "77.5%", top: "47.5%" }, // Singapore
    { id: "hkg", left: "81.0%", top: "41.5%" }, // Hong Kong
    { id: "jpn", left: "84.6%", top: "27.5%" }, // Japan
    { id: "dhk", left: "75.5%", top: "41.5%" }, // Bangladesh
    // MEA
    { id: "bei", left: "62.5%", top: "38.5%" }, // Beirut
    { id: "dxb", left: "66.5%", top: "40.5%" }, // UAE
    { id: "rwa", left: "58.5%", top: "49.5%" }, // Rwanda
  ];

  useGSAP(
    () => {
      if (!sliderRef.current) return;

      // Main rotation animation with hardware acceleration
      // Consistently uses xPercent for seamless looping with transform-origin: left
      const rotation = gsap.to(sliderRef.current, {
        xPercent: -50,
        ease: "none",
        duration: 35, // Slightly slowed down for better visual stability
        repeat: -1,
        force3D: true,
        overwrite: "auto", // Prevent multiple overlapping animations
      });

      // Pulse animation for pins
      const pulse = gsap.to(".globe-pin", {
        scale: 1.2,
        yoyo: true,
        repeat: -1,
        duration: 1,
        ease: "power1.inOut",
        force3D: true,
        stagger: {
          each: 0.1,
          from: "random"
        }
      });

      // Cleanup is handled by useGSAP automatically, 
      // but we explicitly ensure animations are killed if component unmounts unexpectedly
      return () => {
        rotation.kill();
        pulse.kill();
      };
    },
    { scope: globeRef },
  );

  return (
    <div className="globe-wrapper" ref={globeRef}>
      {/* Modal Popup */}
      {selectedLocation && (
        <div
          className="globe-modal-backdrop"
          onClick={() => setSelectedLocation(null)}
        >
          <div
            className="globe-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="globe-modal-close"
              onClick={() => setSelectedLocation(null)}
            >
              ?
            </button>
            <h3 style={{ margin: "0 0 1rem 0", color: "var(--primary-green)" }}>
              {selectedLocation.name}
            </h3>
            <iframe
              src={selectedLocation.mapSrc}
              width="100%"
              height="250"
              style={{ border: 0, borderRadius: "8px", marginBottom: "1.5rem" }}
              allowFullScreen={true}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            ></iframe>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <a
                href={selectedLocation.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn"
                style={{ fontSize: "0.9rem", padding: "0.6rem 1.2rem" }}
              >
                View on Google Maps
              </a>
            </div>
          </div>
        </div>
      )}

      <div className="globe-sun-lighting"></div>
      <div className="globe-container">
        <div className="globe-slider" ref={sliderRef}>
          <div className="globe-map-section">
            {/* Secondary Global Branches */}
            {globalBranches.map((branch) => (
              <div
                key={branch.id + "-1"}
                className="globe-dot-secondary"
                style={{ left: branch.left, top: branch.top }}
              ></div>
            ))}

            {locations.map((loc) => (
              <div
                key={loc.id + "-1"}
                className="globe-pin-wrapper"
                style={{ left: loc.left, top: loc.top, cursor: "pointer" }}
                title={loc.name}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedLocation(loc);
                }}
              >
                <div className="globe-pin"></div>
                <div className="globe-pin-pulse"></div>
                <span className="globe-pin-label">{loc.name}</span>
              </div>
            ))}
          </div>
          <div className="globe-map-section">
            {/* Secondary Global Branches */}
            {globalBranches.map((branch) => (
              <div
                key={branch.id + "-2"}
                className="globe-dot-secondary"
                style={{ left: branch.left, top: branch.top }}
              ></div>
            ))}

            {locations.map((loc) => (
              <div
                key={loc.id + "-2"}
                className="globe-pin-wrapper"
                style={{ left: loc.left, top: loc.top, cursor: "pointer" }}
                title={loc.name}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedLocation(loc);
                }}
              >
                <div className="globe-pin"></div>
                <div className="globe-pin-pulse"></div>
                <span className="globe-pin-label">{loc.name}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="globe-shadow-overlay"></div>
      </div>
    </div>
  );
}
