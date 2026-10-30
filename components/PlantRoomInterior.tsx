"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw, RotateCw } from "lucide-react";
import { LOCATION_GROUPS, LOCATIONS, locationLabel } from "@/lib/plant-locations";
import type * as Three from "three";

const RACKS = [
  { id: "left-three", x: -3.25, z: 1.5, rotation: Math.PI / 2, w: 1.7, d: .7, ys: [.18, .8, 1.42], top: 1.95, color: 0x9c806a },
  { id: "left-five", x: -3.25, z: -1.5, rotation: Math.PI / 2, w: 1.7, d: .7, ys: [.18, .72, 1.26, 1.8, 2.34], top: 2.8, color: 0x9c806a },
  { id: "center-white-1", x: -1.05, z: -3.15, rotation: 0, w: 1.65, d: .7, ys: [.18, .72, 1.26, 1.8, 2.34], top: 2.8, color: 0xf7f8fa },
  { id: "center-white-2", x: 1.05, z: -3.15, rotation: 0, w: 1.65, d: .7, ys: [.18, .72, 1.26, 1.8, 2.34], top: 2.8, color: 0xf7f8fa },
  { id: "lerberg", x: 3.25, z: -2, rotation: -Math.PI / 2, w: 1.45, d: .7, ys: [.18, .9, 1.62, 2.34], top: 2.95, color: 0xe9eef3 },
  { id: "right-trolley", x: 3.25, z: .2, rotation: -Math.PI / 2, w: 1.1, d: .65, ys: [.18, .72, 1.26], top: 1.65, color: 0xd1dce6 },
  { id: "right-black", x: 3.25, z: 2.45, rotation: -Math.PI / 2, w: 1.55, d: .85, ys: [.18, 1.45], top: 2, color: 0x303b49 },
];

export function PlantRoomInterior({ selected, onSelect, counts, labels }: { selected: string; onSelect: (id: string) => void; counts: Record<string, number>; labels?: Record<string, string> }) {
  const host = useRef<HTMLDivElement>(null);
  const pick = useRef(onSelect);
  const selection = useRef(selected);
  const update = useRef<(id: string) => void>(() => undefined);
  const rotate = useRef<(direction: number) => void>(() => undefined);
  const [error, setError] = useState("");
  const selectedGroup = selected.split(":")[0];
  useEffect(() => { pick.current = onSelect; }, [onSelect]);
  useEffect(() => { selection.current = selected; update.current(selected); }, [selected]);

  useEffect(() => {
    let canceled = false;
    let cleanup = () => {};
    const element = host.current!;
    void import("three").then((T) => {
      if (canceled) return;
      const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: "low-power", preserveDrawingBuffer: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25)); renderer.setClearColor(0xf3f5f8, 1);
      renderer.domElement.setAttribute("aria-label", "ㄷ자 식물방 3D 내부"); element.prepend(renderer.domElement);
      const scene = new T.Scene();
      const camera = new T.OrthographicCamera(-6, 6, 6, -6, .1, 60);
      scene.add(new T.HemisphereLight(0xffffff, 0xa9bac8, 2.8));
      const light = new T.DirectionalLight(0xffffff, 2.5); light.position.set(-2, 8, 5); scene.add(light);
      const materials = new Map<number, Three.MeshStandardMaterial>();
      const geometries = new Set<Three.BufferGeometry>();
      const boxGeometry = new T.BoxGeometry(1, 1, 1); geometries.add(boxGeometry);
      const potGeometry = new T.CylinderGeometry(.1, .075, .18, 7); geometries.add(potGeometry);
      const leafGeometry = new T.SphereGeometry(.12, 6, 4); geometries.add(leafGeometry);
      function material(color: number) {
        if (!materials.has(color)) materials.set(color, new T.MeshStandardMaterial({ color, roughness: .85 }));
        return materials.get(color)!;
      }
      function box(parent: Three.Object3D, w: number, h: number, d: number, x: number, y: number, z: number, color: number) {
        const mesh = new T.Mesh(boxGeometry, material(color)); mesh.scale.set(w, h, d); mesh.position.set(x, y, z); parent.add(mesh); return mesh;
      }
      box(scene, 8.6, .12, 8.2, 0, -.08, 0, 0xe1e7eb);
      // Cutaway walls expose the shelves while retaining a three-wall room.
      box(scene, 8.6, 3.25, .1, 0, 1.55, -4.05, 0xe8eef3);
      box(scene, .1, .35, 8.2, -4.25, .1, 0, 0xd9e2eb);
      box(scene, .1, .35, 8.2, 4.25, .1, 0, 0xd9e2eb);
      const targets: Three.Object3D[] = [];
      const shelves = new Map<string, { mesh: Three.Mesh; base: number }>();
      const anchors = new Map<string, { number: Three.Vector3; count: Three.Vector3 }>();
      const rackAnchors = new Map<string, Three.Vector3>();
      for (const spec of RACKS) {
        const rack = new T.Group(); rack.position.set(spec.x, 0, spec.z); rack.rotation.y = spec.rotation; scene.add(rack);
        const steel = spec.id.startsWith("center-") || spec.id === "lerberg" ? 0xd6dee6 : 0x3d4652;
        for (const x of [-1, 1]) for (const z of [-1, 1]) box(rack, .045, spec.top, .045, x * spec.w / 2, spec.top / 2, z * spec.d / 2, steel);
        for (let index = 0; index < spec.ys.length; index++) {
          const y = spec.ys[index], id = `${spec.id}:${index + 1}`;
          const shelf = box(rack, spec.w + .07, .06, spec.d + .02, 0, y, 0, spec.color);
          shelf.userData.location = id; targets.push(shelf); shelves.set(id, { mesh: shelf, base: spec.color });
          const next = spec.ys[index + 1] ?? spec.top;
          rack.updateMatrixWorld(true);
          anchors.set(id, { number: rack.localToWorld(new T.Vector3(-spec.w / 2 - .12, y + .1, spec.d / 2 + .03)), count: rack.localToWorld(new T.Vector3(0, (y + next) / 2, spec.d / 2 + .04)) });
          if ((spec.id === "left-five" && index < 3) || (spec.id === "right-black" && index === 0)) {
            box(rack, spec.w - .08, .035, spec.d, 0, next - .09, 0, 0xc5dde5);
            for (const x of [-1, 1]) box(rack, .025, next - y - .14, spec.d, x * (spec.w / 2 - .04), (next + y) / 2, 0, 0xc5dde5);
          }
          for (let pot = 0; pot < 2; pot++) {
            const x = (pot - .5) * spec.w * .5;
            const plant = new T.Mesh(potGeometry, material(pot ? 0xffffff : 0xa7bfc6)); plant.position.set(x, y + .13, 0); plant.userData.location = id; rack.add(plant); targets.push(plant);
            for (let leaf = 0; leaf < 2; leaf++) {
              const foliage = new T.Mesh(leafGeometry, material(leaf ? 0x8eae76 : 0x396e53)); foliage.scale.set(.7, 1.5, .4); foliage.rotation.z = leaf ? -.45 : .45; foliage.position.set(x + (leaf ? .05 : -.05), y + .33, 0); foliage.userData.location = id; rack.add(foliage); targets.push(foliage);
            }
          }
        }
        rackAnchors.set(spec.id, new T.Vector3(spec.x, spec.top + .45, spec.z));
      }
      let angle = .35, frame = 0, visible = true;
      function place(selector: string, point: Three.Vector3, padding: number) {
        const marker = element.querySelector<HTMLElement>(selector); if (!marker) return;
        const projected = point.clone().project(camera);
        marker.style.left = `${Math.max(padding, Math.min(element.clientWidth - padding, (projected.x + 1) * element.clientWidth / 2))}px`;
        marker.style.top = `${Math.max(14, Math.min(element.clientHeight - 20, (1 - projected.y) * element.clientHeight / 2))}px`;
      }
      function render() {
        frame = 0; if (canceled || !visible || !element.clientWidth || !element.clientHeight) return;
        renderer.render(scene, camera);
        anchors.forEach((points, id) => { place(`[data-zone="${id}"]`, points.number, 12); place(`[data-count-zone="${id}"]`, points.count, 20); });
        rackAnchors.forEach((point, id) => place(`[data-rack="${id}"]`, point, 42));
      }
      function schedule() { if (!frame && !canceled) frame = requestAnimationFrame(render); }
      function resize() {
        if (!element.clientWidth || !element.clientHeight) return;
        const width = element.clientWidth, height = element.clientHeight;
        renderer.setSize(width, height);
        camera.position.set(Math.sin(angle) * 12, 9, Math.cos(angle) * 12); camera.lookAt(0, 1.1, 0); camera.updateMatrixWorld();
        const bounds = new T.Box3(new T.Vector3(-4.45, -.2, -4.2), new T.Vector3(4.45, 3.65, 4.2));
        const projected = new T.Box3();
        for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) projected.expandByPoint(new T.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse));
        const aspect = width / height;
        const half = Math.max((projected.max.y - projected.min.y) / 2 + .35, (projected.max.x - projected.min.x) / 2 / aspect + .3);
        const center = (projected.min.y + projected.max.y) / 2;
        camera.left = -half * aspect; camera.right = half * aspect; camera.top = center + half; camera.bottom = center - half; camera.updateProjectionMatrix(); schedule();
      }
      update.current = (id) => { shelves.forEach(({ mesh, base }, key) => { mesh.material = material(key === id ? 0x4263eb : base); }); schedule(); };
      rotate.current = (direction) => { angle = Math.max(-.7, Math.min(.7, angle + direction * .18)); resize(); };
      const observer = new ResizeObserver(resize); observer.observe(element);
      const visibility = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) resize(); }); visibility.observe(element);
      const ray = new T.Raycaster(); let down = { x: 0, y: 0, angle: 0 };
      const pointerDown = (event: PointerEvent) => { down = { x: event.clientX, y: event.clientY, angle }; };
      const pointerMove = (event: PointerEvent) => {
        if (!event.buttons) return;
        const dx = event.clientX - down.x, dy = event.clientY - down.y;
        if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) { angle = Math.max(-.7, Math.min(.7, down.angle - dx * .005)); resize(); }
      };
      const pointerUp = (event: PointerEvent) => {
        if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > 8) return;
        const rect = renderer.domElement.getBoundingClientRect();
        ray.setFromCamera(new T.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2), camera);
        const id = ray.intersectObjects(targets)[0]?.object.userData.location; if (id) pick.current(id);
      };
      const contextLost = (event: Event) => { event.preventDefault(); setError("3D 화면이 일시 중단됐어요. 아래 선반 목록에서 계속 선택할 수 있어요."); };
      renderer.domElement.addEventListener("pointerdown", pointerDown); renderer.domElement.addEventListener("pointermove", pointerMove); renderer.domElement.addEventListener("pointerup", pointerUp); renderer.domElement.addEventListener("webglcontextlost", contextLost);
      resize(); update.current(selection.current);
      cleanup = () => { observer.disconnect(); visibility.disconnect(); cancelAnimationFrame(frame); renderer.domElement.removeEventListener("pointerdown", pointerDown); renderer.domElement.removeEventListener("pointermove", pointerMove); renderer.domElement.removeEventListener("pointerup", pointerUp); renderer.domElement.removeEventListener("webglcontextlost", contextLost); geometries.forEach((geometry) => geometry.dispose()); materials.forEach((item) => item.dispose()); renderer.dispose(); renderer.domElement.remove(); update.current = () => {}; rotate.current = () => {}; };
    }).catch(() => { if (!canceled) setError("3D 화면을 불러오지 못했어요. 아래 선반 목록에서 선택해주세요."); });
    return () => { canceled = true; cleanup(); };
  }, []);

  return <div className="space-isometric-wrap" role="group" aria-label="식물방 2.5D 배치도">
    <div className="space-isometric-headings"><h2>왼쪽 · 3단장 / 5단장</h2><h2>가운데 · 흰색장 2개</h2><h2>오른쪽 · 레르베리 / 트롤리 / 검은장</h2></div>
    <div className="space-isometric room-interior" ref={host}>
      {LOCATION_GROUPS.map((group) => <button key={group.id} type="button" className="room-rack-label" data-rack={group.id} aria-label={`${group.name} 선택`} title={group.name} aria-pressed={selectedGroup === group.id} onClick={() => onSelect(`${group.id}:1`)}>{group.id.startsWith("center-white-") ? `흰색장 ${group.id.at(-1)}` : group.name}</button>)}
      {LOCATIONS.filter((location) => location.groupId === selectedGroup).map((location) => <div className="space-zone-elements" key={location.id}><button type="button" className="space-pin" data-zone={location.id} aria-label={locationLabel(location.id, labels)} aria-pressed={selected === location.id} onClick={() => onSelect(location.id)}>{location.level}</button><span className="space-zone-count" data-count-zone={location.id} data-selected={selected === location.id} aria-label={`${locationLabel(location.id, labels)} 식물 ${counts[location.id] || 0}개`}>{counts[location.id] || 0}개</span></div>)}
      <div className="room-view-controls"><button type="button" onClick={() => rotate.current(-1)} aria-label="식물방 왼쪽 회전" title="왼쪽 회전"><RotateCcw size={17} /></button><button type="button" onClick={() => rotate.current(1)} aria-label="식물방 오른쪽 회전" title="오른쪽 회전"><RotateCw size={17} /></button></div>
      {error ? <p role="status" className="space-scene-error">{error}</p> : null}
    </div>
  </div>;
}
