import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { GalleryItem } from '../../data/galleryData';
import './CosmicGallery.css';

interface CosmicGalleryProps {
  items: GalleryItem[];
  onSelectItem: (item: GalleryItem) => void;
  selectedCategory: string;
  isDark?: boolean;
}

interface CardObject {
  group: THREE.Group;
  frontMesh: THREE.Mesh;
  backMesh: THREE.Mesh;
  borderMesh: THREE.Mesh;
  glowMesh: THREE.Mesh;
  item: GalleryItem;
  baseTheta: number;
  isHovered: boolean;
  currentZOffset: number;
  currentScale: number;
  currentGlow: number;
}

export default function CosmicGallery({
  items,
  onSelectItem,
  selectedCategory,
}: CosmicGalleryProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredItem, setHoveredItem] = useState<GalleryItem | null>(null);

  // Filter items by category
  const filteredItems = items.filter(
    (item) => selectedCategory === 'All' || item.category === selectedCategory
  );

  const onSelectItemRef = useRef(onSelectItem);
  onSelectItemRef.current = onSelectItem;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animationFrameId: number;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // ── 1. Three.js Scene, Camera, Renderer ────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // Camera with zoomed-in, impactful perspective
    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 100);
    const isMobile = width < 768;
    const baseCamY = isMobile ? 2.5 : 1.6;
    const baseCamZ = isMobile ? 14.8 : 12.6;
    camera.position.set(0, baseCamY, baseCamZ);
    camera.lookAt(0, -0.25, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    // ── 2. Deep Cosmic Starfield ───────────────────────────────────────────
    // Multi-tier stars: brilliant sharp pinpoints and subtle twinkling stars
    const starCount = 1400;
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    const starSizes = new Float32Array(starCount);

    const colorWhite = new THREE.Color(0xffffff);
    const colorDiamond = new THREE.Color(0xd6e8ff);
    const colorBrand = new THREE.Color(0x8dc63f);
    const colorWarm = new THREE.Color(0xfff0d8);

    for (let i = 0; i < starCount; i++) {
      const i3 = i * 3;
      starPositions[i3] = (Math.random() - 0.5) * 60;
      starPositions[i3 + 1] = (Math.random() - 0.5) * 36;
      starPositions[i3 + 2] = -25 + (Math.random() - 0.5) * 50;

      // Color distribution: mostly pure white/celestial, subtle brand green & warm stars
      const rand = Math.random();
      let c = colorWhite;
      if (rand > 0.85) c = colorDiamond;
      else if (rand > 0.72) c = colorBrand;
      else if (rand > 0.6) c = colorWarm;

      starColors[i3] = c.r;
      starColors[i3 + 1] = c.g;
      starColors[i3 + 2] = c.b;

      // Varied star brightness & size
      starSizes[i] = Math.random() * 2.4 + 0.8;
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

    // Crisp circular particle texture with glowing corona
    const starCanvas = document.createElement('canvas');
    starCanvas.width = 32;
    starCanvas.height = 32;
    const sCtx = starCanvas.getContext('2d');
    if (sCtx) {
      const grad = sCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(0.2, 'rgba(255, 255, 255, 0.9)');
      grad.addColorStop(0.5, 'rgba(180, 235, 120, 0.4)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      sCtx.fillStyle = grad;
      sCtx.fillRect(0, 0, 32, 32);
    }
    const starTexture = new THREE.CanvasTexture(starCanvas);

    const starMaterial = new THREE.PointsMaterial({
      size: 0.28,
      vertexColors: true,
      map: starTexture,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const starField = new THREE.Points(starGeometry, starMaterial);
    scene.add(starField);

    // ── 3. Texture Loader & Geometries ─────────────────────────────────────
    const textureLoader = new THREE.TextureLoader();
    const textureCache = new Map<string, THREE.Texture>();

    // Dimensions matching the reference 3D cylinder proportion (zoomed-in & crisp)
    const cardWidth = 2.2;
    const cardHeight = 1.74;

    const frontGeometry = new THREE.PlaneGeometry(cardWidth, cardHeight);
    const backGeometry = new THREE.PlaneGeometry(cardWidth, cardHeight);
    const borderGeometry = new THREE.PlaneGeometry(cardWidth + 0.04, cardHeight + 0.04);
    const glowGeometry = new THREE.PlaneGeometry(cardWidth + 0.35, cardHeight + 0.35);

    // Fallback dark placeholder texture
    const placeholderCanvas = document.createElement('canvas');
    placeholderCanvas.width = 64;
    placeholderCanvas.height = 64;
    const pCtx = placeholderCanvas.getContext('2d');
    if (pCtx) {
      pCtx.fillStyle = '#080d05';
      pCtx.fillRect(0, 0, 64, 64);
    }
    const defaultTexture = new THREE.CanvasTexture(placeholderCanvas);

    // ── 4. 360° Cylinder Ring Arrangement ──────────────────────────────────
    const cardObjects: CardObject[] = [];
    const interactiveMeshes: THREE.Mesh[] = [];
    const totalCards = filteredItems.length;

    // Radius dynamically scales to keep balanced card spacing in full 360° circle
    const arcRadius = Math.max(6.0, (totalCards * 2.5) / (2 * Math.PI));
    const thetaStep = (2 * Math.PI) / Math.max(1, totalCards);

    filteredItems.forEach((item, index) => {
      const cardGroup = new THREE.Group();

      // 1. Subtle Green Halo Glow (rendered behind all card content)
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color('#8dc63f'),
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: true,
      });
      const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
      glowMesh.position.z = 0;
      glowMesh.renderOrder = 0;
      cardGroup.add(glowMesh);

      // 2. Border backplate (rendered between glow and photo, no depth buffer pollution)
      const borderMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(0x141e10),
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: true,
      });
      const borderMesh = new THREE.Mesh(borderGeometry, borderMaterial);
      borderMesh.position.z = 0;
      borderMesh.renderOrder = 1;
      cardGroup.add(borderMesh);

      // Load texture
      let texture = textureCache.get(item.image);
      if (!texture) {
        texture = textureLoader.load(item.image, (loadedTex) => {
          loadedTex.colorSpace = THREE.SRGBColorSpace;
          loadedTex.generateMipmaps = true;
          loadedTex.minFilter = THREE.LinearMipmapLinearFilter;
        });
        textureCache.set(item.image, texture);
      }

      // 3. Front Mesh (Facing outwards from cylinder, rendered in front with highest order)
      const frontMaterial = new THREE.MeshBasicMaterial({
        map: texture || defaultTexture,
        side: THREE.FrontSide,
      });
      const frontMesh = new THREE.Mesh(frontGeometry, frontMaterial);
      frontMesh.position.z = 0.02;
      frontMesh.renderOrder = 2;
      frontMesh.userData = { galleryItem: item, cardIndex: index };
      cardGroup.add(frontMesh);
      interactiveMeshes.push(frontMesh);

      // 4. Back Mesh (Facing inwards towards cylinder center, rendered in front from the rear)
      const backMaterial = new THREE.MeshBasicMaterial({
        map: texture || defaultTexture,
        side: THREE.FrontSide,
        color: new THREE.Color(0xe8e8e8),
      });
      const backMesh = new THREE.Mesh(backGeometry, backMaterial);
      backMesh.rotation.y = Math.PI;
      backMesh.position.z = -0.02;
      backMesh.renderOrder = 2;
      backMesh.userData = { galleryItem: item, cardIndex: index };
      cardGroup.add(backMesh);
      interactiveMeshes.push(backMesh);

      // Position around the 360° cylinder
      const baseTheta = index * thetaStep;

      scene.add(cardGroup);

      cardObjects.push({
        group: cardGroup,
        frontMesh,
        backMesh,
        borderMesh,
        glowMesh,
        item,
        baseTheta,
        isHovered: false,
        currentZOffset: 0,
        currentScale: 1,
        currentGlow: 0,
      });
    });

    // ── 5. User Interaction (Orbit, Momentum, Drag, Wheel, Raycast) ─────────
    let panOffset = 0;
    let targetPanOffset = 0;
    let isDragging = false;
    let pointerStartX = 0;
    let panStartOffset = 0;
    let pointerMovedDistance = 0;
    let lastPointerX = 0;
    let lastPointerTime = 0;
    let velocity = 0;
    const autoRotateSpeed = 0.0012; // slow celestial auto-spin

    const raycaster = new THREE.Raycaster();
    const pointerNDC = new THREE.Vector2(-999, -999);

    const updatePointer = (clientX: number, clientY: number) => {
      const rect = container.getBoundingClientRect();
      pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerMove = (e: PointerEvent) => {
      updatePointer(e.clientX, e.clientY);

      if (isDragging) {
        const deltaX = e.clientX - pointerStartX;
        pointerMovedDistance += Math.abs(e.clientX - lastPointerX);

        const now = performance.now();
        const dt = Math.max(1, now - lastPointerTime);
        velocity = (e.clientX - lastPointerX) / dt * 0.015;

        lastPointerX = e.clientX;
        lastPointerTime = now;

        targetPanOffset = panStartOffset + deltaX * 0.0038;
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      pointerStartX = e.clientX;
      lastPointerX = e.clientX;
      lastPointerTime = performance.now();
      panStartOffset = targetPanOffset;
      pointerMovedDistance = 0;
      velocity = 0;
    };

    const onPointerUp = (e: PointerEvent) => {
      if (isDragging && pointerMovedDistance < 8) {
        // Treat as click: raycast to open modal
        updatePointer(e.clientX, e.clientY);
        raycaster.setFromCamera(pointerNDC, camera);
        const intersects = raycaster.intersectObjects(interactiveMeshes, false);
        if (intersects.length > 0) {
          const clickedItem = intersects[0].object.userData.galleryItem as GalleryItem;
          if (clickedItem) {
            onSelectItemRef.current(clickedItem);
          }
        }
      }
      isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY || e.deltaX;
      targetPanOffset -= delta * 0.0016;
      velocity = -delta * 0.0003;
    };

    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    container.addEventListener('wheel', onWheel, { passive: false });

    // ── 6. Window Resize ───────────────────────────────────────────────────
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      const mobile = w < 768;
      camera.fov = mobile ? 48 : 46;
      const bY = mobile ? 2.0 : 1.1;
      const bZ = mobile ? 14.8 : 12.6;
      camera.position.set(0, bY, bZ);
      camera.lookAt(0, -0.25, 0);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // ── 7. Animation Loop ──────────────────────────────────────────────────
    let lastHoveredId: string | null = null;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Inertia and gentle continuous auto-spin
      if (!isDragging) {
        if (Math.abs(velocity) > 0.00008) {
          targetPanOffset += velocity;
          velocity *= 0.94; // friction deceleration
        } else {
          targetPanOffset += autoRotateSpeed; // celestial orbit
        }
      }

      // Smooth pan lerp
      panOffset += (targetPanOffset - panOffset) * 0.08;

      // Camera stays fixed — no mouse parallax
      const curWidth = container.clientWidth || window.innerWidth;
      const isMob = curWidth < 768;
      const bCamY = isMob ? 2.0 : 1.1;
      const bCamZ = isMob ? 14.8 : 12.6;
      camera.position.set(0, bCamY, bCamZ);
      camera.lookAt(0, -0.25, 0);

      // Starfield subtle cosmic drift (time-based only)
      starField.rotation.y = elapsedTime * 0.008;
      starField.rotation.x = elapsedTime * 0.004;

      // Raycasting for hover state
      if (!isDragging) {
        raycaster.setFromCamera(pointerNDC, camera);
        const intersects = raycaster.intersectObjects(interactiveMeshes, false);
        let foundHoverId: string | null = null;

        cardObjects.forEach((card) => {
          const isIntersect =
            intersects.length > 0 &&
            (intersects[0].object === card.frontMesh || intersects[0].object === card.backMesh);

          card.isHovered = isIntersect;
          if (isIntersect) {
            foundHoverId = card.item.id;
          }
        });

        if (foundHoverId !== lastHoveredId) {
          lastHoveredId = foundHoverId;
          const matched = cardObjects.find((c) => c.item.id === foundHoverId);
          setHoveredItem(matched ? matched.item : null);
          if (container) {
            if (matched) {
              container.classList.add('is-hovering');
            } else {
              container.classList.remove('is-hovering');
            }
          }
        }
      }

      // Update 360° Cylinder Positions & Rotations
      cardObjects.forEach((card) => {
        const currentAngle = card.baseTheta + panOffset;

        // Position on horizontal circle
        const x = Math.sin(currentAngle) * arcRadius;
        const z = Math.cos(currentAngle) * arcRadius;

        // Rotation around Y axis tangent to cylinder
        card.group.rotation.y = currentAngle;

        // Hover scale and normal offset
        const targetScale = card.isHovered ? 1.1 : 1.0;
        card.currentScale += (targetScale - card.currentScale) * 0.12;
        card.group.scale.set(card.currentScale, card.currentScale, card.currentScale);

        const targetZBoost = card.isHovered ? 0.45 : 0;
        card.currentZOffset += (targetZBoost - card.currentZOffset) * 0.14;

        // Offset outward along cylinder normal
        const normalX = Math.sin(currentAngle);
        const normalZ = Math.cos(currentAngle);

        // Subtle floating cosmic wave oscillation
        const galleryY = 1.1;
        const waveY =
          galleryY +
          Math.sin(elapsedTime * 0.8 + card.baseTheta * 2) * 0.04;

        card.group.position.set(
          x + normalX * card.currentZOffset,
          waveY,
          z + normalZ * card.currentZOffset
        );

        // Glow halo on hover (subtle 0.25 - 0.35 opacity)
        const targetGlow = card.isHovered ? 0.32 : 0;
        card.currentGlow += (targetGlow - card.currentGlow) * 0.15;
        const glowMat = card.glowMesh.material as THREE.MeshBasicMaterial;
        glowMat.opacity = card.currentGlow;
      });

      renderer.render(scene, camera);
    };

    animate();

    // ── Cleanup ────────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('wheel', onWheel);

      starGeometry.dispose();
      starMaterial.dispose();
      starTexture.dispose();
      frontGeometry.dispose();
      backGeometry.dispose();
      borderGeometry.dispose();
      glowGeometry.dispose();

      cardObjects.forEach((card) => {
        scene.remove(card.group);
      });

      textureCache.forEach((tex) => tex.dispose());
      renderer.dispose();

      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [filteredItems]);

  return (
    <div className="cosmic-gallery-viewport" ref={containerRef}>
      {/* Subtle overlay hint */}
      <div className="cosmic-gallery-hint">
        <span className="hint-pill">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3" />
          </svg>
          Drag or scroll to rotate orbit · Click card to inspect
        </span>
      </div>

      {/* Dynamic Hover Card HUD */}
      {hoveredItem && (
        <div className="cosmic-hover-badge" key={hoveredItem.id}>
          <span className="hover-badge-category">{hoveredItem.category}</span>
          <h4 className="hover-badge-title">{hoveredItem.title}</h4>
          <span className="hover-badge-date">{hoveredItem.date}</span>
        </div>
      )}
    </div>
  );
}
