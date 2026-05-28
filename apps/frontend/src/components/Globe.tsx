import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import GlobeGL from 'react-globe.gl';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { generateDoodleGlobeTexture } from '../utils/doodleGlobe';
import './Globe.css';

gsap.registerPlugin(ScrollTrigger);

const Globe = () => {
  const globeRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [countries, setCountries] = useState<{ features: any[] }>({ features: [] });
  const [doodleTextureUrl, setDoodleTextureUrl] = useState<string | null>(null);

  const [globeReady, setGlobeReady] = useState(false);
  const [inkSplash, setInkSplash] = useState<{ lat: number; lng: number } | null>(null);

  const allBranches = useMemo(() => [
    {
      id: "vit-chennai",
      name: "VIT Chennai",
      lat: 12.8406,
      lng: 80.1533,
      size: 0.8,
      color: '#8dc63f',
      isPrimary: true,
      mapSrc: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3890.3159938833917!2d80.1533094!3d12.8406259!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3a5259af8e491f67%3A0x944b42131b757d2d!2sVellore%20Institute%20of%20Technology%20-%20VIT%20Chennai!5e0!3m2!1sen!2sin!4v1716911684347!5m2!1sen!2sin",
      googleMapsUrl: "https://www.google.com/maps/search/VIT+Chennai,+Chennai,+Tamil+Nadu,+India/@12.8406259,80.1533094,17z",
    },
    { id: "vlr", lat: 12.9717, lng: 79.1594, name: "Vellore", color: '#ffffff' },
    { id: "trc", lat: 10.7905, lng: 78.7047, name: "Trichy", color: '#ffffff' },
    { id: "khp", lat: 22.3460, lng: 87.2320, name: "Kharagpur", color: '#ffffff' },
    { id: "hyd", lat: 17.3850, lng: 78.4867, name: "Hyderabad", color: '#ffffff' },
    { id: "delhi", lat: 28.6139, lng: 77.2090, name: "Delhi", color: '#ffffff' },
    { id: "pune", lat: 18.5204, lng: 73.8567, name: "Pune", color: '#ffffff' },
    { id: "bom", lat: 19.0760, lng: 72.8777, name: "Mumbai", color: '#ffffff' },
    { id: "lon", lat: 51.5074, lng: -0.1278, name: "London", color: '#ffffff' },
    { id: "cam", lat: 52.2053, lng: 0.1218, name: "Cambridge", color: '#ffffff' },
    { id: "edi", lat: 55.9533, lng: -3.1883, name: "Edinburgh", color: '#ffffff' },
    { id: "war", lat: 52.3793, lng: -1.5615, name: "Warwick", color: '#ffffff' },
    { id: "pri", lat: 40.3431, lng: -74.6551, name: "Princeton", color: '#ffffff' },
    { id: "bos", lat: 42.3601, lng: -71.0589, name: "Boston", color: '#ffffff' },
    { id: "nyc", lat: 40.7128, lng: -74.0060, name: "New York", color: '#ffffff' },
    { id: "la", lat: 34.0522, lng: -118.2437, name: "Los Angeles", color: '#ffffff' },
    { id: "tor", lat: 43.6532, lng: -79.3832, name: "Toronto", color: '#ffffff' },
    { id: "mel", lat: -37.8136, lng: 144.9631, name: "Melbourne", color: '#ffffff' },
    { id: "sgp", lat: 1.3521, lng: 103.8198, name: "Singapore", color: '#ffffff' },
    { id: "hkg", lat: 22.3193, lng: 114.1694, name: "Hong Kong", color: '#ffffff' },
    { id: "jpn", lat: 35.6762, lng: 139.6503, name: "Tokyo", color: '#ffffff' },
    { id: "ber", lat: 52.5200, lng: 13.4050, name: "Berlin", color: '#ffffff' },
    { id: "par", lat: 48.8566, lng: 2.3522, name: "Paris", color: '#ffffff' },
    { id: "ams", lat: 52.3676, lng: 4.9041, name: "Amsterdam", color: '#ffffff' },
    { id: "dxb", lat: 25.2048, lng: 55.2708, name: "Dubai", color: '#ffffff' },
    { id: "syd", lat: -33.8688, lng: 151.2093, name: "Sydney", color: '#ffffff' },
  ], []);

  const [selectedLocation, setSelectedLocation] = useState<any>(null);

  useEffect(() => {
    const worldUrl = 'https://raw.githubusercontent.com/vasturiano/three-globe/master/example/country-polygons/ne_110m_admin_0_countries.geojson';
    const indiaUrl = 'https://gist.githubusercontent.com/jbrobst/56c13bbbf9d97d187fea01ca62ea5112/raw/india_states.geojson';

    Promise.all([
      fetch(worldUrl).then(res => res.json()),
      fetch(indiaUrl).then(res => res.json())
    ]).then(([worldData, indiaData]) => {
      const otherCountries = worldData.features.filter((f: any) => f.properties.ISO_A3 !== 'IND');
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
    if (countries.features.length === 0) return;

    const timer = setTimeout(() => {
      const worldFeatures = countries.features.filter((f: any) => f.properties.ISO_A3 !== 'IND');
      const indiaFeatures = countries.features.filter((f: any) => f.properties.ISO_A3 === 'IND');

      const texUrl = generateDoodleGlobeTexture(
        { features: worldFeatures },
        { features: indiaFeatures },
        1024,
        512
      );
      setDoodleTextureUrl(texUrl);

      setGlobeReady(true);
    }, 300);

    return () => clearTimeout(timer);
  }, [countries, allBranches]);

  useEffect(() => {
    if (!globeRef.current) return;

    globeRef.current.pointOfView({ lat: 22, lng: 82, altitude: 2.2 }, 0);
    globeRef.current.controls().autoRotate = true;
    globeRef.current.controls().autoRotateSpeed = 0.5;

    const scrollAnim = gsap.to({}, {
      scrollTrigger: {
        trigger: containerRef.current,
        start: "top bottom",
        end: "bottom top",
        scrub: 1,
        onUpdate: (self) => {
          if (globeRef.current) {
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

  const handleGlobeClick = useCallback(() => {
    if (globeRef.current) {
      const chennai = allBranches.find(b => b.id === 'vit-chennai');
      if (chennai) {
        globeRef.current.pointOfView({
          lat: chennai.lat,
          lng: chennai.lng,
          altitude: 1.8
        }, 1000);
        setSelectedLocation(chennai);
        setInkSplash({ lat: chennai.lat, lng: chennai.lng });
        setTimeout(() => setInkSplash(null), 600);
      }
    }
  }, [allBranches]);

  const handlePointClick = useCallback((point: any) => {
    if (point.mapSrc) {
      setSelectedLocation(point);
      setInkSplash({ lat: point.lat, lng: point.lng });
      setTimeout(() => setInkSplash(null), 600);
    }
  }, []);

  const handleLabelClick = useCallback((label: any) => {
    if (label.mapSrc) {
      setSelectedLocation(label);
      setInkSplash({ lat: label.lat, lng: label.lng });
      setTimeout(() => setInkSplash(null), 600);
    }
  }, []);

  return (
    <div className="globe-3d-wrapper" ref={containerRef}>
      {selectedLocation && selectedLocation.id === 'vit-chennai' && (
        <div
          className="campus-panel-overlay"
          onClick={() => setSelectedLocation(null)}
        >
          <div
            className="campus-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="campus-panel-close"
              onClick={() => setSelectedLocation(null)}
            >
              ✕
            </button>

            <div className="campus-panel-header">
              <div className="campus-panel-image">
                <img src="/images/VIT-chennai.png" alt="VIT Chennai Campus" />
              </div>
              <div className="campus-panel-info">
                <h2>VIT Chennai</h2>
                <p className="campus-panel-location">
                  Vellore Institute of Technology, Chennai Campus
                </p>
                <p className="campus-panel-desc">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
                </p>
                <a
                  href={selectedLocation.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn"
                >
                  View on Google Maps
                </a>
              </div>
            </div>

            <div className="campus-panel-buildings">
              <h3>Campus Buildings & Auditoriums</h3>
              <div className="campus-building-grid">
                {[
                  "img1", "img2", "img3", "img4",
                  "img5", "img6", "img7", "img8",
                  "img9", "img10", "img11", "img12",
                ].map((name) => (
                  <div key={name} className="campus-building-card">
                    <div className="campus-building-image">
                      <span>{name}</span>
                    </div>
                    <p className="campus-building-name">{name}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {globeReady && doodleTextureUrl && (
        <GlobeGL
          ref={globeRef}
          width={700}
          height={700}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl={doodleTextureUrl}

          polygonsData={countries.features}
          polygonCapColor={(d: any) =>
            d.properties.ISO_A3 === 'IND'
              ? 'rgba(141, 198, 63, 0.25)'
              : 'rgba(200, 190, 175, 0.12)'
          }
          polygonSideColor={() => 'rgba(0, 0, 0, 0.03)'}
          polygonStrokeColor={(d: any) =>
            d.properties.ISO_A3 === 'IND' ? '#8dc63f' : 'rgba(100, 100, 100, 0.3)'
          }
          polygonLabel={({ properties: d }: any) => `
            <div class="globe-label">
              <b>${d.ADMIN || d.ST_NM}</b>
            </div>
          `}
          onPolygonHover={() => {}}

          onGlobeClick={handleGlobeClick}

          pointsData={allBranches}
          pointLat="lat"
          pointLng="lng"
          pointColor="color"
          pointAltitude={0.12}
          pointRadius={(d: any) => d.isPrimary ? 1.5 : 0.6}
          pointsMerge={false}
          pointLabel="name"
          onPointClick={handlePointClick}

          labelsData={allBranches}
          labelLat="lat"
          labelLng="lng"
          labelText="name"
          labelSize={(d: any) => d.isPrimary ? 2.5 : 1.2}
          labelDotRadius={(d: any) => d.isPrimary ? 0.8 : 0.4}
          labelColor={(d: any) => d.isPrimary ? '#8dc63f' : '#ffffff'}
          labelResolution={2}
          onLabelClick={handleLabelClick}

          ringsData={allBranches}
          ringLat="lat"
          ringLng="lng"
          ringColor={(d: any) =>
            d.isPrimary ? 'rgba(141, 198, 63, 0.8)' : 'rgba(255, 255, 255, 0.4)'
          }
          ringMaxRadius={(d: any) => d.isPrimary ? 3.5 : 1.8}
          ringPropagationSpeed={3}
          ringRepeatPeriod={1000}

        />
      )}

      {!globeReady && (
        <div className="globe-doodle-loading">
          <svg width="60" height="60" viewBox="0 0 60 60">
            <path
              d="M30 5 Q35 10 30 15 Q25 10 30 5Z"
              fill="none"
              stroke="#8dc63f"
              strokeWidth="1.5"
              className="doodle-loading-pen"
            />
            <circle
              cx="30" cy="30" r="20"
              fill="none"
              stroke="#8dc63f"
              strokeWidth="1.5"
              strokeDasharray="3 4"
              className="doodle-loading-circle"
            />
          </svg>
          <span className="doodle-loading-text">Sketching the world...</span>
        </div>
      )}

      {inkSplash && (
        <div
          className="ink-splash-container"
          style={{ pointerEvents: 'none', zIndex: 100 }}
        >
          <div className="ink-drop ink-drop-1" />
          <div className="ink-drop ink-drop-2" />
          <div className="ink-drop ink-drop-3" />
        </div>
      )}

      <div className="globe-overlay-info">
        <h3>180DC Global Impact</h3>
        <p>Interactive 3D Network Visualization</p>
      </div>
    </div>
  );
};

export default Globe;
