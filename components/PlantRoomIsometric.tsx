"use client";

import { useEffect, useRef, useState } from "react";
import { LOCATIONS, locationLabel } from "@/lib/plant-locations";
import type * as Three from "three";

const zoneNames = ["3단장 · 5단장", "레르베리", "검은장"];
const zoneEdges = [0, 0.44, 0.72, 1];
const zoneFor = (id: string) => id.startsWith("left-") ? 0 : id.startsWith("lerberg") ? 1 : 2;

export function PlantRoomIsometric({ selected, onSelect, counts, labels }: { selected: string; onSelect: (id: string) => void; counts: Record<string, number>; labels?: Record<string, string> }) {
  const host = useRef<HTMLDivElement>(null);
  const pick = useRef(onSelect);
  const currentSelection = useRef(selected);
  const update = useRef<(id: string) => void>(() => undefined);
  const [error, setError] = useState("");
  useEffect(() => { pick.current = onSelect; }, [onSelect]);
  useEffect(() => { currentSelection.current = selected; update.current(selected); }, [selected]);
  useEffect(() => {
    let canceled = false;
    let cleanup = () => undefined;
    const element = host.current!;
    void import("three").then((T) => {
      if (canceled) return;
      const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power", preserveDrawingBuffer: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.setClearColor(0xf3f5f8, 1);
      renderer.setScissorTest(true);
      renderer.domElement.setAttribute("aria-label", "세 구역의 2.5D 선반");
      element.prepend(renderer.domElement);
      const scenes = [new T.Scene(), new T.Scene(), new T.Scene()];
      const racks = scenes.map((scene) => { const group = new T.Group(); scene.add(group); scene.add(new T.HemisphereLight(0xffffff, 0xbac3d0, 2.5)); const light = new T.DirectionalLight(0xffffff, 2.5); light.position.set(2, 6, 5); scene.add(light); return group; });
      const cameras = scenes.map(() => new T.OrthographicCamera(-2, 2, 3, -1, 0.1, 40));
      const targets: Three.Mesh[][] = [[], [], []];
      const shelves = new Map<string, { mesh: Three.Mesh<Three.BoxGeometry, Three.MeshStandardMaterial>; base: number }>();
      const anchors = new Map<string, { number: Three.Vector3; count: Three.Vector3 }>();
      function box(zone: number, w: number, h: number, d: number, x: number, y: number, z: number, color: number, opacity = 1) {
        const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), new T.MeshStandardMaterial({ color, transparent: opacity < 1, opacity, roughness: 0.8 }));
        mesh.position.set(x, y, z); racks[zone].add(mesh); return mesh;
      }
      const specs = [
        { id: "left-three", zone: 0, x: -0.35, z: 0.85, w: 0.9, d: 0.65, ys: [0.18, 0.8, 1.42], top: 2.0, color: 0x96745c },
        { id: "left-five", zone: 0, x: 0.35, z: -0.5, w: 0.9, d: 0.65, ys: [0.18, 0.72, 1.26, 1.8, 2.34], top: 2.8, color: 0x96745c },
        { id: "lerberg", zone: 1, x: 0, z: 0, w: 1.15, d: 0.7, ys: [0.18, 0.9, 1.62, 2.34], top: 2.95, color: 0xe4e9ed },
        { id: "right-black", zone: 2, x: 0, z: 0, w: 1.35, d: 0.85, ys: [0.18, 1.45], top: 2.0, color: 0x303b49 },
      ];
      specs.forEach((spec) => {
        for (const dx of [-1, 1]) for (const dz of [-1, 1]) box(spec.zone, 0.04, spec.top, 0.04, spec.x + dx * spec.w / 2, spec.top / 2, spec.z + dz * spec.d / 2, spec.id === "lerberg" ? 0xd9e0e7 : 0x3d4652);
        spec.ys.forEach((y, index) => {
          const shelf = box(spec.zone, spec.w + 0.07, 0.055, spec.d + 0.02, spec.x, y, spec.z, spec.color);
          const location = LOCATIONS.find((item) => item.id === `${spec.id}:${index + 1}`);
          if (!location) { box(spec.zone, 0.4, 0.22, 0.35, spec.x, y + 0.14, spec.z, 0xd6dee5); return; }
          shelves.set(location.id, { mesh: shelf, base: spec.color });
          const nextShelf = spec.ys[index + 1] ?? spec.top;
          anchors.set(location.id, {
            number: new T.Vector3(spec.x - spec.w / 2 - 0.07, y + 0.07, spec.z + spec.d / 2),
            count: new T.Vector3(spec.x, (y + nextShelf) / 2, spec.z + spec.d / 2),
          });
          const register = (mesh: Three.Mesh) => { mesh.userData.location = location.id; targets[spec.zone].push(mesh); };
          register(shelf);
          const enclosed = spec.id === "left-five" || (spec.id === "right-black" && index === 0);
          if (enclosed) {
            const h = spec.id === "right-black" ? 1.05 : 0.43;
            register(box(spec.zone, spec.w - 0.05, h, spec.d - 0.02, spec.x, y + h / 2 + 0.04, spec.z, 0xa8d3df, 0.2));
            box(spec.zone, spec.w - 0.05, 0.025, spec.d, spec.x, y + h + 0.04, spec.z, 0xc9dfe9);
          }
          for (let pot = 0; pot < 3; pot++) {
            const x = spec.x + (pot - 1) * spec.w * 0.27;
            const plant = new T.Mesh(new T.CylinderGeometry(0.105, 0.075, 0.18, 8), new T.MeshStandardMaterial({ color: pot === 1 ? 0xcdb49a : 0xffffff }));
            plant.position.set(x, y + 0.12, spec.z); racks[spec.zone].add(plant); register(plant);
            for (let leaf = 0; leaf < 3; leaf++) {
              const foliage = new T.Mesh(new T.SphereGeometry(0.1, 7, 5), new T.MeshStandardMaterial({ color: [0x396e53, 0x8eae76, 0x557e5d][leaf] }));
              foliage.scale.set(0.7, 1.6, 0.4); foliage.rotation.z = (leaf - 1) * 0.7; foliage.position.set(x + (leaf - 1) * 0.07, y + 0.32, spec.z); racks[spec.zone].add(foliage); register(foliage);
            }
          }
        });
      });
      function render() {
        const width = element.clientWidth, height = element.clientHeight;
        scenes.forEach((scene, zone) => {
          const start = Math.floor(width * zoneEdges[zone]), end = Math.floor(width * zoneEdges[zone + 1]);
          renderer.setViewport(start, 0, end - start, height); renderer.setScissor(start, 0, end - start, height); renderer.render(scene, cameras[zone]);
        });
        anchors.forEach((points, id) => {
          const zone = zoneFor(id);
          for (const [selector, point, margin] of [
            [`[data-zone="${id}"]`, points.number, 9],
            [`[data-count-zone="${id}"]`, points.count, 19],
          ] as const) {
            const p = point.clone().project(cameras[zone]);
            const marker = element.querySelector<HTMLElement>(selector);
            if (marker) {
              const zoneWidth = width * (zoneEdges[zone + 1] - zoneEdges[zone]);
              const x = Math.max(margin, Math.min(zoneWidth - margin, (p.x + 1) * zoneWidth / 2));
              marker.style.left = `${zoneEdges[zone] * width + x}px`; marker.style.top = `${(-p.y + 1) * height / 2}px`;
            }
          }
        });
      }
      function resize() {
        const width = element.clientWidth, height = element.clientHeight; if (!width || !height) return;
        renderer.setSize(width, height);
        racks.forEach((rack, zone) => {
          const bounds = new T.Box3().setFromObject(rack), center = bounds.getCenter(new T.Vector3());
          const camera = cameras[zone]; camera.position.copy(center).add(new T.Vector3(3.2, 2.2, 7)); camera.lookAt(center); camera.updateMatrixWorld();
          const projected = new T.Box3();
          for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) projected.expandByPoint(new T.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse));
          const aspect = width * (zoneEdges[zone + 1] - zoneEdges[zone]) / height;
          const halfHeight = Math.max((projected.max.y - projected.min.y) / 2 + 0.25, (projected.max.x - projected.min.x) / 2 / aspect + 0.15);
          camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect; camera.top = halfHeight; camera.bottom = -halfHeight; camera.updateProjectionMatrix();
        }); render();
      }
      update.current = (id) => { shelves.forEach(({ mesh, base }, key) => mesh.material.color.set(key === id ? 0x4263eb : base)); render(); };
      const observer = new ResizeObserver(resize); observer.observe(element);
      const ray = new T.Raycaster(); let down = { x: 0, y: 0 };
      const pointerDown = (event: PointerEvent) => { down = { x: event.clientX, y: event.clientY }; };
      const pointerUp = (event: PointerEvent) => {
        if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > 8) return;
        const rect = renderer.domElement.getBoundingClientRect(), x = event.clientX - rect.left, y = event.clientY - rect.top;
        const fraction = x / rect.width;
        const zone = fraction < zoneEdges[1] ? 0 : fraction < zoneEdges[2] ? 1 : 2;
        const localX = (fraction - zoneEdges[zone]) / (zoneEdges[zone + 1] - zoneEdges[zone]);
        ray.setFromCamera(new T.Vector2(localX * 2 - 1, 1 - y / rect.height * 2), cameras[zone]);
        const location = ray.intersectObjects(targets[zone])[0]?.object.userData.location;
        if (location) pick.current(location);
      };
      renderer.domElement.addEventListener("pointerdown", pointerDown); renderer.domElement.addEventListener("pointerup", pointerUp);
      resize(); update.current(currentSelection.current);
      cleanup = () => { observer.disconnect(); renderer.domElement.removeEventListener("pointerdown", pointerDown); renderer.domElement.removeEventListener("pointerup", pointerUp); scenes.forEach((scene) => scene.traverse((object) => { if (object instanceof T.Mesh) { object.geometry.dispose(); const materials = Array.isArray(object.material) ? object.material : [object.material]; materials.forEach((material) => material.dispose()); } })); renderer.dispose(); renderer.domElement.remove(); update.current = () => undefined; };
    }).catch(() => { if (!canceled) setError("선반 화면을 불러오지 못했어요. 아래 공간 목록에서 선택해주세요."); });
    return () => { canceled = true; cleanup(); };
  }, []);
  return <div className="space-isometric-wrap" role="group" aria-label="식물방 2.5D 배치도">
    <div className="space-isometric-headings">{zoneNames.map((name) => <h2 key={name}>{name}</h2>)}</div>
    <div className="space-isometric" ref={host}>
      {LOCATIONS.map((location) => <div className="space-zone-elements" key={location.id}>
        <button type="button" className="space-pin" data-zone={location.id} aria-label={locationLabel(location.id, labels)} aria-pressed={selected === location.id} onClick={() => onSelect(location.id)}>{location.level}</button>
        <span className="space-zone-count" data-count-zone={location.id} data-selected={selected === location.id} aria-label={`${locationLabel(location.id, labels)} 식물 ${counts[location.id] || 0}개`}>{counts[location.id] || 0}개</span>
      </div>)}
      {error ? <p role="status" className="space-scene-error">{error}</p> : null}
    </div>
  </div>;
}
