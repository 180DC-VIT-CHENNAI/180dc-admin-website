import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { GalleryItem } from '../../data/galleryData';
import './CosmicGallery.css';

interface CosmicGalleryProps {
  items: GalleryItem[];
  onSelectItem: (item: GalleryItem) => void;
  selectedCategory: string;
  isDark?: boolean;
  isModalOpen?: boolean;
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

const FIXED_RADIUS = 6.0;
const CARD_WIDTH = 2.0;
const CARD_HEIGHT = 1.58;
const RAYCAST_THROTTLE_MS = 33;

export default function CosmicGallery({
  items,
  onSelectItem,
  isDark = true,
  isModalOpen = false,
}: CosmicGalleryProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredItem, setHoveredItem] = useState<GalleryItem | null>(null);
  const filteredItems = useMemo(() => items, [items]);
  const onSelectItemRef = useRef(onSelectItem);
  onSelectItemRef.current = onSelectItem;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animationFrameId: number;
    let disposed = false;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const bgColor = isDark ? 0x0a0a0a : 0xffffff;
    const starMainColor = isDark ? 0xffffff : 0x333333;
    const starAccentColor = 0x8dc63f;
    const borderColor = isDark ? 0x141e10 : 0xe0e0e0;
    const placeholderBg = isDark ? '#0a1206' : '#f0f4e8';
    const starOpacity = isDark ? 0.8 : 0.5;
    const starBlending = isDark ? THREE.AdditiveBlending : THREE.NormalBlending;
    const backFaceColor = isDark ? 0xe8e8e8 : 0xf5f5f5;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(bgColor);

    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 100);
    const isMobile = width < 768;
    camera.position.set(0, isMobile ? 2.5 : 1.1, isMobile ? 14.8 : 12.6);
    camera.lookAt(0, -0.25, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = isDark ? 1.15 : 1.0;
    container.appendChild(renderer.domElement);

    const starCount = 800;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(starCount * 3);
    const starCol = new Float32Array(starCount * 3);
    const cMain = new THREE.Color(starMainColor);
    const cAccent = new THREE.Color(starAccentColor);
    for (let i = 0; i < starCount; i++) {
      const i3 = i * 3;
      starPos[i3] = (Math.random() - 0.5) * 60;
      starPos[i3 + 1] = (Math.random() - 0.5) * 36;
      starPos[i3 + 2] = -25 + (Math.random() - 0.5) * 50;
      const c = Math.random() > 0.9 ? cAccent : cMain;
      starCol[i3] = c.r; starCol[i3 + 1] = c.g; starCol[i3 + 2] = c.b;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3));
    const starCanvas = document.createElement('canvas');
    starCanvas.width = 32; starCanvas.height = 32;
    const sCtx = starCanvas.getContext('2d');
    if (sCtx) {
      const g = sCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
      const sColor = isDark ? '255,255,255' : '60,60,60';
      g.addColorStop(0, `rgba(${sColor},1)`);
      g.addColorStop(0.3, `rgba(${sColor},0.7)`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      sCtx.fillStyle = g;
      sCtx.fillRect(0, 0, 32, 32);
    }
    const starField = new THREE.Points(starGeo, new THREE.PointsMaterial({
      size: 0.25, vertexColors: true, map: new THREE.CanvasTexture(starCanvas),
      transparent: true, opacity: starOpacity, blending: starBlending, depthWrite: false,
    }));
    scene.add(starField);

    const phCanvas = document.createElement('canvas');
    phCanvas.width = 64; phCanvas.height = 64;
    const phCtx = phCanvas.getContext('2d');
    if (phCtx) {
      phCtx.fillStyle = placeholderBg;
      phCtx.fillRect(0, 0, 64, 64);
      phCtx.strokeStyle = 'rgba(141,198,63,0.2)';
      phCtx.lineWidth = 1;
      phCtx.strokeRect(4, 4, 56, 56);
    }
    const placeholderTex = new THREE.CanvasTexture(phCanvas);

    const frontGeo = new THREE.PlaneGeometry(CARD_WIDTH, CARD_HEIGHT);
    const backGeo = new THREE.PlaneGeometry(CARD_WIDTH, CARD_HEIGHT);
    const borderGeo = new THREE.PlaneGeometry(CARD_WIDTH + 0.04, CARD_HEIGHT + 0.04);
    const glowGeo = new THREE.PlaneGeometry(CARD_WIDTH + 0.3, CARD_HEIGHT + 0.3);

    const textureCache = new Map<string, THREE.Texture>();
    const textureUrls = [...new Set(filteredItems.map(i => i.image))];

    for (const url of textureUrls) {
      if (disposed) break;
      fetch(url)
        .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.blob(); })
        .then(blob => createImageBitmap(blob))
        .then(bitmap => {
          if (disposed) { bitmap.close(); return; }
          const tex = new THREE.CanvasTexture(bitmap);
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.minFilter = THREE.LinearMipmapLinearFilter;
          tex.generateMipmaps = true;
          textureCache.set(url, tex);
        })
        .catch(() => {});
    }

    const cardObjects: CardObject[] = [];
    const interactiveMeshes: THREE.Mesh[] = [];
    const totalCards = filteredItems.length;
    const thetaStep = (2 * Math.PI) / Math.max(1, totalCards);

    filteredItems.forEach((item, index) => {
      const cardGroup = new THREE.Group();

      const glowMat = new THREE.MeshBasicMaterial({
        color: 0x8dc63f, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false,
      });
      const glowMesh = new THREE.Mesh(glowGeo, glowMat);
      glowMesh.renderOrder = 0;
      cardGroup.add(glowMesh);

      const borderMat = new THREE.MeshBasicMaterial({
        color: borderColor, side: THREE.DoubleSide, depthWrite: false,
      });
      const borderMesh = new THREE.Mesh(borderGeo, borderMat);
      borderMesh.renderOrder = 1;
      cardGroup.add(borderMesh);

      const frontMat = new THREE.MeshBasicMaterial({ map: placeholderTex, side: THREE.FrontSide });
      const frontMesh = new THREE.Mesh(frontGeo, frontMat);
      frontMesh.position.z = 0.02;
      frontMesh.renderOrder = 2;
      frontMesh.userData = { galleryItem: item, cardIndex: index };
      cardGroup.add(frontMesh);
      interactiveMeshes.push(frontMesh);

      const backMat = new THREE.MeshBasicMaterial({
        map: placeholderTex, side: THREE.FrontSide, color: backFaceColor,
      });
      const backMesh = new THREE.Mesh(backGeo, backMat);
      backMesh.rotation.y = Math.PI;
      backMesh.position.z = -0.02;
      backMesh.renderOrder = 2;
      backMesh.userData = { galleryItem: item, cardIndex: index };
      cardGroup.add(backMesh);
      interactiveMeshes.push(backMesh);

      const baseTheta = index * thetaStep;
      scene.add(cardGroup);

      cardObjects.push({
        group: cardGroup, frontMesh, backMesh, borderMesh, glowMesh,
        item, baseTheta, isHovered: false,
        currentZOffset: 0, currentScale: 1, currentGlow: 0,
      });
    });

    let panOffset = 0;
    let targetPanOffset = 0;
    let isDragging = false;
    let pointerStartX = 0;
    let panStartOffset = 0;
    let pointerMovedDistance = 0;
    let lastPointerX = 0;
    let lastPointerTime = 0;
    let velocity = 0;
    const autoRotateSpeed = 0.0012;

    const raycaster = new THREE.Raycaster();
    const pointerNDC = new THREE.Vector2(-999, -999);
    let lastRaycastTime = 0;
    const appliedSet = new Set<string>();

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
        updatePointer(e.clientX, e.clientY);
        raycaster.setFromCamera(pointerNDC, camera);
        const intersects = raycaster.intersectObjects(interactiveMeshes, false);
        if (intersects.length > 0) {
          const clickedItem = intersects[0].object.userData.galleryItem as GalleryItem;
          if (clickedItem) onSelectItemRef.current(clickedItem);
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

    const handleResize = () => {
      if (!container || disposed) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      const mobile = w < 768;
      camera.fov = mobile ? 48 : 46;
      camera.position.set(0, mobile ? 2.0 : 1.1, mobile ? 14.8 : 12.6);
      camera.lookAt(0, -0.25, 0);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    let lastHoveredId: string | null = null;
    const clock = new THREE.Clock();

    const animate = () => {
      if (disposed) return;
      animationFrameId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      if (!isDragging) {
        if (Math.abs(velocity) > 0.00008) {
          targetPanOffset += velocity;
          velocity *= 0.94;
        } else {
          targetPanOffset += autoRotateSpeed;
        }
      }
      panOffset += (targetPanOffset - panOffset) * 0.08;

      const cw = container.clientWidth || window.innerWidth;
      const mob = cw < 768;
      camera.position.set(0, mob ? 2.0 : 1.1, mob ? 14.8 : 12.6);
      camera.lookAt(0, -0.25, 0);

      starField.rotation.y = t * 0.006;
      starField.rotation.x = t * 0.003;

      const now = performance.now();
      if (now - lastRaycastTime > RAYCAST_THROTTLE_MS) {
        lastRaycastTime = now;
        raycaster.setFromCamera(pointerNDC, camera);
        const intersects = raycaster.intersectObjects(interactiveMeshes, false);
        let foundHoverId: string | null = null;
        cardObjects.forEach((card) => {
          const hit = intersects.length > 0 &&
            (intersects[0].object === card.frontMesh || intersects[0].object === card.backMesh);
          card.isHovered = hit;
          if (hit) foundHoverId = card.item.id;
        });
        if (foundHoverId !== lastHoveredId) {
          lastHoveredId = foundHoverId;
          const matched = cardObjects.find((c) => c.item.id === foundHoverId);
          setHoveredItem(matched ? matched.item : null);
          container.classList.toggle('is-hovering', !!matched);
        }
      }

      cardObjects.forEach((card) => {
        const angle = card.baseTheta + panOffset;
        const x = Math.sin(angle) * FIXED_RADIUS;
        const z = Math.cos(angle) * FIXED_RADIUS;

        card.group.lookAt(camera.position);
        card.group.rotateY(Math.PI);

        const ts = card.isHovered ? 1.12 : 1.0;
        card.currentScale += (ts - card.currentScale) * 0.12;
        card.group.scale.setScalar(card.currentScale);

        const tz = card.isHovered ? 0.5 : 0;
        card.currentZOffset += (tz - card.currentZOffset) * 0.14;

        const nx = Math.sin(angle);
        const nz = Math.cos(angle);
        const wy = 1.1 + Math.sin(t * 0.8 + card.baseTheta * 2) * 0.04;

        card.group.position.set(x + nx * card.currentZOffset, wy, z + nz * card.currentZOffset);

        const tg = card.isHovered ? 0.35 : 0;
        card.currentGlow += (tg - card.currentGlow) * 0.15;
        (card.glowMesh.material as THREE.MeshBasicMaterial).opacity = card.currentGlow;

        const tex = textureCache.get(card.item.image);
        if (tex && !appliedSet.has(card.item.id)) {
          (card.frontMesh.material as THREE.MeshBasicMaterial).map = tex;
          (card.frontMesh.material as THREE.MeshBasicMaterial).needsUpdate = true;
          (card.backMesh.material as THREE.MeshBasicMaterial).map = tex;
          (card.backMesh.material as THREE.MeshBasicMaterial).needsUpdate = true;
          appliedSet.add(card.item.id);
        }
      });

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('wheel', onWheel);

      starGeo.dispose();
      starField.material.dispose();
      (starField.material.map as THREE.Texture)?.dispose();
      frontGeo.dispose();
      backGeo.dispose();
      borderGeo.dispose();
      glowGeo.dispose();
      placeholderTex.dispose();
      textureCache.forEach((tex) => tex.dispose());
      textureCache.clear();
      renderer.dispose();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [filteredItems, isDark]);

  return (
    <div className={`cosmic-gallery-viewport ${isModalOpen ? 'modal-open' : ''}`} ref={containerRef}>
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
