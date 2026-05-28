import React, { useEffect, useRef, useState, useMemo } from 'react';
import GlobeGL from 'react-globe.gl';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './Globe.css';

// Register ScrollTrigger if not already registered (handled in App.tsx usually but safe here)
gsap.registerPlugin(ScrollTrigger);

const Globe = () => {
  const globeRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [countries, setCountries] = useState({ features: [] });
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);

  // Locations data
  const mainLocations = useMemo(() => [
    {
      id: "vit-chennai",
      name: "VIT Chennai",
      lat: 12.8406,
      lng: 80.1533,
      size: 0.5,
      color: '#8dc63f',
      mapSrc: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3890.3159938833917!2d80.1533094!3d12.8406259!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3a5259af8e491f67%3A0x944b42131b757d2d!2sVellore%20Institute%20of%20Technology%20-%20VIT%20Chennai!5e0!3m2!1sen!2sin!4v1716911684347!5m2!1sen!2sin",
      googleMapsUrl: "https://www.google.com/maps/search/VIT+Chennai,+Chennai,+Tamil+Nadu,+India/@12.8406259,80.1533094,17z",
    }
  ], []);

  const secondaryBranches = useMemo(() => [
    { id: "vlr", lat: 12.9717, lng: 79.1594, name: "Vellore" },
    { id: "trc", lat: 10.7905, lng: 78.7047, name: "Trichy" },
    { id: "khp", lat: 22.3460, lng: 87.2320, name: "Kharagpur" },
    { id: "hyd", lat: 17.3850, lng: 78.4867, name: "Hyderabad" },
    { id: "delhi", lat: 28.6139, lng: 77.2090, name: "Delhi" },
    { id: "lon", lat: 51.5074, lng: -0.1278, name: "London" },
    { id: "cam", lat: 52.2053, lng: 0.1218, name: "Cambridge" },
    { id: "edi", lat: 55.9533, lng: -3.1883, name: "Edinburgh" },
    { id: "pri", lat: 40.3431, lng: -74.6551, name: "Princeton" },
    { id: "tor", lat: 43.6532, lng: -79.3832, name: "Toronto" },
    { id: "mel", lat: -37.8136, lng: 144.9631, name: "Melbourne" },
    { id: "sgp", lat: 1.3521, lng: 103.8198, name: "Singapore" },
    { id: "hkg", lat: 22.3193, lng: 114.1694, name: "Hong Kong" },
    { id: "jpn", lat: 35.6762, lng: 139.6503, name: "Tokyo" },
    { id: "ber", lat: 52.5200, lng: 13.4050, name: "Berlin" },
    { id: "par", lat: 48.8566, lng: 2.3522, name: "Paris" },
  ], []);

  const [selectedLocation, setSelectedLocation] = useState<any>(null);

  useEffect(() => {
    // Load World GeoJSON and Official India GeoJSON (including PoK and Aksai Chin)
    const worldUrl = 'https://raw.githubusercontent.com/vasturiano/three-globe/master/example/country-polygons/ne_110m_admin_0_countries.geojson';
    const indiaUrl = 'https://gist.githubusercontent.com/jbrobst/56c13bbbf9d97d187fea01ca62ea5112/raw/india_states.geojson';

    Promise.all([
      fetch(worldUrl).then(res => res.json()),
      fetch(indiaUrl).then(res => res.json())
    ]).then(([worldData, indiaData]) => {
      // Filter out original India from world map to avoid overlap issues
      const otherCountries = worldData.features.filter((f: any) => f.properties.ISO_A3 !== 'IND');
      
      // Tag India state features as part of India for consistent styling
      const indiaFeatures = indiaData.features.map((f: any) => ({
        ...f,
        properties: {
          ...f.properties,
          ISO_A3: 'IND',
          ADMIN: 'India'
        }
      }));

      setCountries({ features: [...otherCountries, ...indiaFeatures] });
    }).catch(err => {
      console.error("Error loading GeoJSON data:", err);
    });
  }, []);

  useEffect(() => {
    if (!globeRef.current) return;

    // Set initial camera position - focused on India
    globeRef.current.pointOfView({ lat: 22, lng: 82, altitude: 2.2 }, 0);

    // Auto-rotation
    globeRef.current.controls().autoRotate = true;
    globeRef.current.controls().autoRotateSpeed = 0.5;

    // GSAP Scroll Animation
    const scrollAnim = gsap.to({}, {
      scrollTrigger: {
        trigger: containerRef.current,
        start: "top bottom",
        end: "bottom top",
        scrub: 1,
        onUpdate: (self) => {
          if (globeRef.current) {
            // Zoom in as we scroll towards the section
            const altitude = 2.2 - (self.progress * 0.7);
            globeRef.current.pointOfView({ altitude }, 0);
          }
        }
      }
    });

    return () => {
      scrollAnim.kill();
    };
  }, []);

  return (
    <div className="globe-3d-wrapper" ref={containerRef}>
      {/* Modal Popup */}
      {selectedLocation && (
        <div
          className="globe-modal-backdrop"
          onClick={() => setSelectedLocation(null)}
          style={{ zIndex: 10000 }}
        >
          <div
            className="globe-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="globe-modal-close"
              onClick={() => setSelectedLocation(null)}
            >
              ✕
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

      <GlobeGL
        ref={globeRef}
        width={700}
        height={700}
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        
        // Polygons (Country Borders)
        polygonsData={countries.features}
        polygonCapColor={(d: any) => d.properties.ISO_A3 === 'IND' ? 'rgba(141, 198, 63, 0.4)' : 'rgba(255, 255, 255, 0.05)'}
        polygonSideColor={() => 'rgba(0, 0, 0, 0.05)'}
        polygonStrokeColor={(d: any) => d.properties.ISO_A3 === 'IND' ? '#8dc63f' : '#444'}
        polygonLabel={({ properties: d }: any) => `
          <div class="globe-label">
            <b>${d.ADMIN || d.ST_NM}</b>
          </div>
        `}
        onPolygonHover={(d: any) => setHoveredCountry(d ? d.properties.ISO_A3 : null)}

        // Points (Main Locations)
        pointsData={mainLocations}
        pointLat="lat"
        pointLng="lng"
        pointColor="color"
        pointAltitude={0.12}
        pointRadius={1.2} // Increased for better clickability
        pointsMerge={false}
        pointLabel="name"
        onPointClick={(point: any) => {
          console.log("Point clicked:", point);
          setSelectedLocation(point);
        }}

        // Labels
        labelsData={mainLocations}
        labelLat="lat"
        labelLng="lng"
        labelText="name"
        labelSize={2.0} // Increased size
        labelDotRadius={0.7}
        labelColor={() => '#8dc63f'}
        labelResolution={2}
        onLabelClick={(label: any) => {
          console.log("Label clicked:", label);
          setSelectedLocation(label);
        }}

        // Rings (Secondary Branches)
        ringsData={secondaryBranches}
        ringLat="lat"
        ringLng="lng"
        ringColor={() => 'rgba(141, 198, 63, 0.6)'}
        ringMaxRadius={2.5}
        ringPropagationSpeed={3}
        ringRepeatPeriod={800}
      />
      <div className="globe-overlay-info">
        <h3>180DC Global Impact</h3>
        <p>Interactive 3D Network Visualization</p>
      </div>
    </div>
  );
};

export default Globe;
