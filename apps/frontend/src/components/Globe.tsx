/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import GlobeGL from 'react-globe.gl';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { generateGlobeTexture } from '../utils/doodleGlobe';
import { TOKENS } from '../lib/tokens';
import './Globe.css';

gsap.registerPlugin(ScrollTrigger);

const Globe = () => {
  const navigate = useNavigate();
  const globeRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [countries, setCountries] = useState<{ features: any[] }>({ features: [] });
  const [doodleTextureUrl, setDoodleTextureUrl] = useState<string | null>(null);
  const [globeSize, setGlobeSize] = useState(700);

  const [globeReady, setGlobeReady] = useState(false);

  useEffect(() => {
    function updateSize() {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth;
        setGlobeSize(Math.min(w, 700));
      }
    }
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const allBranches = useMemo(() => [
    {
      id: "vit-chennai",
      name: "VIT Chennai",
      lat: 12.8406,
      lng: 80.1533,
      size: 0.8,
      color: TOKENS.accentPrimary,
      isPrimary: true,
      mapSrc: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3890.3159938833917!2d80.1533094!3d12.8406259!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3a5259af8e491f67%3A0x944b42131b757d2d!2sVellore%20Institute%20of%20Technology%20-%20VIT%20Chennai!5e0!3m2!1sen!2sin!4v1716911684347!5m2!1sen!2sin",
      googleMapsUrl: "https://www.google.com/maps/search/VIT+Chennai,+Chennai,+Tamil+Nadu,+India/@12.8406259,80.1533094,17z",
    },
    { id: "vlr", lat: 12.9717, lng: 79.1594, name: "Vellore", color: TOKENS.white },
    { id: "trc", lat: 10.7905, lng: 78.7047, name: "Trichy", color: TOKENS.white },
    { id: "khp", lat: 22.3460, lng: 87.2320, name: "Kharagpur", color: TOKENS.white },
    { id: "hyd", lat: 17.3850, lng: 78.4867, name: "Hyderabad", color: TOKENS.white },
    { id: "delhi", lat: 28.6139, lng: 77.2090, name: "Delhi", color: TOKENS.white },
    { id: "pune", lat: 18.5204, lng: 73.8567, name: "Pune", color: TOKENS.white },
    { id: "bom", lat: 19.0760, lng: 72.8777, name: "Mumbai", color: TOKENS.white },
    { id: "lon", lat: 51.5074, lng: -0.1278, name: "London", color: TOKENS.white },
    { id: "cam", lat: 52.2053, lng: 0.1218, name: "Cambridge", color: TOKENS.white },
    { id: "edi", lat: 55.9533, lng: -3.1883, name: "Edinburgh", color: TOKENS.white },
    { id: "war", lat: 52.3793, lng: -1.5615, name: "Warwick", color: TOKENS.white },
    { id: "pri", lat: 40.3431, lng: -74.6551, name: "Princeton", color: TOKENS.white },
    { id: "bos", lat: 42.3601, lng: -71.0589, name: "Boston", color: TOKENS.white },
    { id: "nyc", lat: 40.7128, lng: -74.0060, name: "New York", color: TOKENS.white },
    { id: "la", lat: 34.0522, lng: -118.2437, name: "Los Angeles", color: TOKENS.white },
    { id: "tor", lat: 43.6532, lng: -79.3832, name: "Toronto", color: TOKENS.white },
    { id: "mel", lat: -37.8136, lng: 144.9631, name: "Melbourne", color: TOKENS.white },
    { id: "sgp", lat: 1.3521, lng: 103.8198, name: "Singapore", color: TOKENS.white },
    { id: "hkg", lat: 22.3193, lng: 114.1694, name: "Hong Kong", color: TOKENS.white },
    { id: "jpn", lat: 35.6762, lng: 139.6503, name: "Tokyo", color: TOKENS.white },
    { id: "ber", lat: 52.5200, lng: 13.4050, name: "Berlin", color: TOKENS.white },
    { id: "par", lat: 48.8566, lng: 2.3522, name: "Paris", color: TOKENS.white },
    { id: "ams", lat: 52.3676, lng: 4.9041, name: "Amsterdam", color: TOKENS.white },
    { id: "dxb", lat: 25.2048, lng: 55.2708, name: "Dubai", color: TOKENS.white },
    { id: "syd", lat: -33.8688, lng: 151.2093, name: "Sydney", color: TOKENS.white },
  ], []);

  useEffect(() => {
    const WORLD_URLS = [
      '/data/countries.geojson',
      'https://cdn.jsdelivr.net/gh/vasturiano/three-globe@master/example/country-polygons/ne_110m_admin_0_countries.geojson',
      'https://raw.githubusercontent.com/vasturiano/three-globe/master/example/country-polygons/ne_110m_admin_0_countries.geojson',
    ];
    const INDIA_URLS = [
      '/data/india_states.geojson',
      'https://cdn.jsdelivr.net/gh/jbrobst/56c13bbbf9d97d187fea01ca62ea5112@1f01f7e/india_states.geojson',
      'https://gist.githubusercontent.com/jbrobst/56c13bbbf9d97d187fea01ca62ea5112/raw/india_states.geojson',
    ];

    async function fetchWithFallback(urls: string[]): Promise<any> {
      for (const url of urls) {
        try {
          const res = await fetch(url);
          if (res.ok) return await res.json();
        } catch {}
      }
      throw new Error('All fetch attempts failed');
    }

    Promise.all([
      fetchWithFallback(WORLD_URLS),
      fetchWithFallback(INDIA_URLS),
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
    const timer = setTimeout(() => {
      if (countries.features.length > 0) {
        const worldFeatures = countries.features.filter((f: any) => f.properties.ISO_A3 !== 'IND');
        const indiaFeatures = countries.features.filter((f: any) => f.properties.ISO_A3 === 'IND');

        const texUrl = generateGlobeTexture(
          { features: worldFeatures },
          { features: indiaFeatures },
          1024,
          512
        );
        setDoodleTextureUrl(texUrl);
      }
      setGlobeReady(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, [countries, allBranches]);

  useEffect(() => {
    if (!globeRef.current) return;

    globeRef.current.pointOfView({ lat: 20, lng: 78, altitude: 1.6 }, 0);
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
            const altitude = 1.6 - (self.progress * 0.5);
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
    navigate('/gallery');
  }, [navigate]);

  const handlePointClick = useCallback(() => {
    navigate('/gallery');
  }, [navigate]);

  const handleLabelClick = useCallback(() => {
    navigate('/gallery');
  }, [navigate]);

  return (
    <div className="globe-3d-wrapper" ref={containerRef}>
      {globeReady && doodleTextureUrl && (
        <GlobeGL
          ref={globeRef}
          width={globeSize}
          height={globeSize}
          backgroundColor="rgba(0,0,0,0)"
          globeImageUrl={doodleTextureUrl}

          polygonsData={countries.features}
          polygonCapColor={(d: any) =>
            d.properties.ISO_A3 === 'IND'
              ? TOKENS.indiaFill
              : 'rgba(200, 190, 175, 0.12)'
          }
          polygonSideColor={() => 'rgba(0, 0, 0, 0.03)'}
          polygonStrokeColor={(d: any) =>
            d.properties.ISO_A3 === 'IND' ? TOKENS.accentPrimary : 'rgba(100, 100, 100, 0.3)'
          }
          polygonLabel={({ properties: d }: any) => {
            let name = (d.ADMIN || d.ST_NM || "");
            name = name.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
            if (!name.trim()) return "";
            return `<div class="globe-label"><b>${name}</b></div>`;
          }}
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
          labelColor={(d: any) => d.isPrimary ? TOKENS.accentPrimary : TOKENS.white}
          labelResolution={2}
          onLabelClick={handleLabelClick}

          ringsData={allBranches}
          ringLat="lat"
          ringLng="lng"
          ringColor={(d: any) =>
            d.isPrimary ? TOKENS.indiaRing : 'rgba(255, 255, 255, 0.4)'
          }
          ringMaxRadius={(d: any) => d.isPrimary ? 3.5 : 1.8}
          ringPropagationSpeed={3}
          ringRepeatPeriod={1000}

        />
      )}

      {!globeReady && (
        <div className="globe-doodle-loading">
          <svg width="60" height="60" viewBox="0 0 60 60" style={{ color: 'var(--accent-primary)' }}>
            <path
              d="M30 5 Q35 10 30 15 Q25 10 30 5Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="doodle-loading-pen"
            />
            <circle
              cx="30" cy="30" r="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="3 4"
              className="doodle-loading-circle"
            />
          </svg>
          <span className="doodle-loading-text">Loading globe...</span>
        </div>
      )}

      {/* Floating doodle annotations */}
      <div className="globe-doodle-annotation top-left arrow">VIT Chennai Campus</div>
      <div className="globe-doodle-annotation top-right">190+ Branches</div>
      <div className="globe-doodle-annotation bottom-left arrow">Click to explore</div>
      <div className="globe-doodle-annotation bottom-right">Global Network</div>

      {/* Corner doodle decorations */}
      <svg className="globe-corner-doodle top-left" viewBox="0 0 40 40" fill="none" style={{ color: 'var(--accent-primary)' }}>
        <path d="M5 35 Q10 20, 20 15 T35 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
        <circle cx="35" cy="5" r="3" fill="currentColor" />
      </svg>
      <svg className="globe-corner-doodle top-right" viewBox="0 0 40 40" fill="none" style={{ color: 'var(--accent-primary)' }}>
        <path d="M5 35 Q10 20, 20 15 T35 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
        <circle cx="35" cy="5" r="3" fill="currentColor" />
      </svg>
      <svg className="globe-corner-doodle bottom-left" viewBox="0 0 40 40" fill="none" style={{ color: 'var(--accent-primary)' }}>
        <path d="M5 35 Q10 20, 20 15 T35 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
        <circle cx="35" cy="5" r="3" fill="currentColor" />
      </svg>
      <svg className="globe-corner-doodle bottom-right" viewBox="0 0 40 40" fill="none" style={{ color: 'var(--accent-primary)' }}>
        <path d="M5 35 Q10 20, 20 15 T35 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
        <circle cx="35" cy="5" r="3" fill="currentColor" />
      </svg>

      <div className="globe-overlay-info">
        <h3>180DC Global Impact</h3>
        <p>Interactive 3D Network Visualization</p>
      </div>
    </div>
  );
};

export default Globe;
