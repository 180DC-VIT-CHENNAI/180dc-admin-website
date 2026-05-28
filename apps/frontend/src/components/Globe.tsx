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

  useEffect(() => {
    // Load GeoJSON for country borders
    fetch('https://raw.githubusercontent.com/vasturiano/three-globe/master/example/country-polygons/ne_110m_admin_0_countries.geojson')
      .then(res => res.json())
      .then(setCountries);
  }, []);

  useEffect(() => {
    if (!globeRef.current) return;

    // Set initial camera position
    globeRef.current.pointOfView({ lat: 20, lng: 80, altitude: 2.5 }, 0);

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
            const altitude = 2.5 - (self.progress * 0.8);
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
      <GlobeGL
        ref={globeRef}
        width={700}
        height={700}
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        
        // Polygons (Country Borders)
        polygonsData={countries.features}
        polygonCapColor={(d: any) => d.properties.ISO_A3 === 'IND' ? 'rgba(141, 198, 63, 0.3)' : 'rgba(255, 255, 255, 0.05)'}
        polygonSideColor={() => 'rgba(0, 0, 0, 0.05)'}
        polygonStrokeColor={(d: any) => d.properties.ISO_A3 === 'IND' ? '#8dc63f' : '#444'}
        polygonLabel={({ properties: d }: any) => `
          <div class="globe-label">
            <b>${d.ADMIN} (${d.ISO_A3})</b>
          </div>
        `}
        onPolygonHover={(d: any) => setHoveredCountry(d ? d.properties.ISO_A3 : null)}

        // Points (Main Locations)
        pointsData={mainLocations}
        pointLat="lat"
        pointLng="lng"
        pointColor="color"
        pointAltitude={0.1}
        pointRadius={0.5}
        pointsMerge={true}
        pointLabel="name"

        // Labels
        labelsData={mainLocations}
        labelLat="lat"
        labelLng="lng"
        labelText="name"
        labelSize={1.5}
        labelDotRadius={0.5}
        labelColor={() => '#8dc63f'}
        labelResolution={2}

        // Rings (Secondary Branches)
        ringsData={secondaryBranches}
        ringLat="lat"
        ringLng="lng"
        ringColor={() => 'rgba(141, 198, 63, 0.6)'}
        ringMaxRadius={2}
        ringPropagationSpeed={2}
        ringRepeatPeriod={1000}
      />
      <div className="globe-overlay-info">
        <h3>180DC Global Impact</h3>
        <p>Interactive 3D Network Visualization</p>
      </div>
    </div>
  );
};

export default Globe;
