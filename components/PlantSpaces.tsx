"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Download, History, Layers3, MapPin, Pencil, Search, X } from "lucide-react";
import { PlantRoomIsometric } from "@/components/PlantRoomIsometric";
import { PlantCoverThumbnail } from "@/components/PlantCoverThumbnail";
import { emptyLocationState, LOCATION_GROUPS, LOCATIONS, LOCATION_STORAGE_KEY, locationLabel as defaultLocationLabel, parseLocationState, recordMovement, type LocationState } from "@/lib/plant-locations";
import { matchesPlantSearch } from "@/lib/plant-search";
import type { Plant } from "@/types/plant";
import "./plant-spaces.css";

function today() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date()); }

export function PlantSpaces() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceError, setSourceError] = useState("");
  const [state, setState] = useState<LocationState>(emptyLocationState);
  const [storageReady, setStorageReady] = useState(false);
  const [storageBlocked, setStorageBlocked] = useState(false);
  const [persistence, setPersistence] = useState<"checking" | "notion" | "local" | "error">("checking");
  const source = useRef("checking");
  const [saving, setSaving] = useState(false);
  const savingNow = useRef(false);
  const operation = useRef<{ signature: string; id: string } | null>(null);
  const renameOperation = useRef<{ signature: string; id: string } | null>(null);
  const [saveResults, setSaveResults] = useState<{ plantId: string; success: boolean; message?: string }[]>([]);
  const [location, setLocation] = useState("lerberg:1");
  const [scope, setScope] = useState("unassigned");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [moving, setMoving] = useState(false);
  const [destination, setDestination] = useState("lerberg:1");
  const [date, setDate] = useState(today);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [cardsOpen, setCardsOpen] = useState(false);
  const cardsBack = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!moving && !cardsOpen) return;
    const overflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = "hidden";
    if (cardsOpen) cardsBack.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { if (!savingNow.current) { setMoving(false); setCardsOpen(false); } return; }
      if (event.key !== "Tab") return;
      const items = document.querySelector('[role="dialog"]')?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input, select, textarea');
      if (!items?.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", onKey); if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true }); };
  }, [moving, cardsOpen]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const loadLocalTrial = () => {
      source.current = "local"; setPersistence("local");
      try { setState(parseLocationState(window.localStorage.getItem(LOCATION_STORAGE_KEY))); setStorageReady(true); }
      catch { setError("이 기기의 위치 기록을 읽을 수 없어 저장을 잠갔어요."); setStorageBlocked(true); }
    };
    void fetch("/api/location-logs", { signal: controller.signal, cache: "no-store" }).then(async (response) => {
      const data = await response.json();
      if (!response.ok || data.source !== "notion" || !data.state) throw new Error(data.message || "노션 위치 기록을 가져오지 못했어요.");
      if (!active) return;
      source.current = "notion"; setPersistence("notion");
      setState(parseLocationState(JSON.stringify(data.state))); setStorageReady(true);
    }).catch((cause) => {
      if (!active) return;
      if (process.env.NODE_ENV === "development") { loadLocalTrial(); return; }
      source.current = "error"; setPersistence("error"); setStorageBlocked(true);
      setError(cause instanceof Error ? cause.message : "노션 위치 기록을 가져오지 못했어요.");
    });
    const sync = (event: StorageEvent) => {
      if (source.current !== "local") return;
      if (event.key !== LOCATION_STORAGE_KEY && event.key !== null) return;
      try { setState(parseLocationState(event.newValue)); setSelected([]); setMoving(false); setStorageBlocked(false); setStorageReady(true); setMessage("다른 창의 위치 기록을 반영했어요."); }
      catch { setStorageBlocked(true); setError("다른 창의 위치 기록을 읽을 수 없어요."); }
    };
    window.addEventListener("storage", sync);
    return () => { active = false; controller.abort(); window.removeEventListener("storage", sync); };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/space-plants", { signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error(); const data = await response.json(); if (data.source !== "notion" || !Array.isArray(data.plants)) throw new Error(); setPlants(data.plants); })
      .catch(() => { if (!controller.signal.aborted) setSourceError("실제 식물 목록을 가져오지 못했어요. 새로고침 후 다시 확인해주세요."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const plant of plants) { const position = state.positions[plant.id]; if (position) result[position] = (result[position] || 0) + 1; }
    return result;
  }, [plants, state.positions]);
  const unassigned = plants.filter((plant) => !state.positions[plant.id]).length;
  const displayed = plants.filter((plant) => (scope === "all" || (scope === "unassigned" ? !state.positions[plant.id] : state.positions[plant.id] === scope)) && matchesPlantSearch(plant, query));
  const selectedPlants = plants.filter((plant) => selected.includes(plant.id));
  const chosenLocation = LOCATIONS.find((item) => item.id === location)!;
  const group = LOCATION_GROUPS.find((item) => item.id === chosenLocation.groupId)!;
  const locationLabel = (id: string | null | undefined) => defaultLocationLabel(id, state.labels);
  const allChecked = displayed.length > 0 && displayed.every((plant) => selected.includes(plant.id));

  function selectLocation(id: string) { setLocation(id); setScope(id); setQuery(""); setSelected([]); setMessage(""); setEditingName(false); setCardsOpen(false); }
  function changeScope(value: string) { setScope(value); setSelected([]); setQuery(""); setCardsOpen(false); }
  function openCards(id: string) { selectLocation(id); setCardsOpen(true); }
  function toggle(id: string) { setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); setMessage(""); }
  async function refreshLocations() {
    const response = await fetch("/api/location-logs", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok || data.source !== "notion" || !data.state) throw new Error(data.message || "위치 기록을 다시 읽지 못했어요.");
    setState(parseLocationState(JSON.stringify(data.state)));
  }
  async function save() {
    if (!storageReady || storageBlocked || savingNow.current) return;
    savingNow.current = true; setSaving(true); setError(""); setSaveResults([]);
    try {
      if (persistence === "notion") {
        const signature = JSON.stringify([destination, date, reason]);
        if (operation.current?.signature !== signature) operation.current = { signature, id: crypto.randomUUID() };
        const results: { plantId: string; success: boolean; message?: string }[] = [];
        for (let offset = 0; offset < selectedPlants.length; offset += 8) {
          const batch = selectedPlants.slice(offset, offset + 8);
          try {
            const response = await fetch("/api/location-logs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plantIds: batch.map((plant) => plant.id), destination, date, note: reason, name: state.labels?.[destination] || LOCATIONS.find((item) => item.id === destination)?.name, operationId: operation.current.id }) });
            const data = await response.json();
            if (!response.ok || !Array.isArray(data.results)) throw new Error(data.message || "저장 결과를 확인하지 못했어요.");
            for (const plant of batch) results.push(data.results.find((item: { plantId: string }) => item.plantId === plant.id) ?? { plantId: plant.id, success: false, message: "저장 결과를 확인하지 못했어요." });
          } catch (cause) { results.push(...batch.map((plant) => ({ plantId: plant.id, success: false, message: cause instanceof Error ? cause.message : "저장을 확인하지 못했어요." }))); }
          setSaveResults([...results]);
        }
        setSelected(results.filter((item) => !item.success).map((item) => item.plantId));
        const successes = results.filter((item) => item.success).length;
        setMessage(`${successes}개 식물 위치를 노션에 저장했어요.${results.length > successes ? ` ${results.length - successes}개는 확인 후 다시 저장해주세요.` : ""}`);
        try { await refreshLocations(); }
        catch { setError("저장 결과는 위와 같아요. 최신 위치를 불러오려면 새로고침해주세요. 같은 기록을 다시 만들 필요는 없어요."); }
        if (successes === results.length) { operation.current = null; setLocation(destination); setScope(destination); setQuery(""); setMoving(false); setReason(""); }
        return;
      }
      // Read immediately before saving so another tab's latest positions are not overwritten.
      const latest = parseLocationState(window.localStorage.getItem(LOCATION_STORAGE_KEY));
      const next = recordMovement(latest, selectedPlants, destination, date, reason, crypto.randomUUID());
      const added = next.history.length - latest.history.length;
      if (!added) { setError("선택한 식물은 이미 그 공간에 있어요."); return; }
      window.localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(next));
      setState(next); setLocation(destination); setScope(destination); setSelected([]); setQuery(""); setMoving(false); setReason(""); setError("");
      setMessage(`${added}개 식물의 ${latest.history.length ? "위치 변경" : "위치"}을 이 기기에 저장했어요.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "저장 공간이 부족하거나 저장이 차단되어 있어요."); }
    finally { savingNow.current = false; setSaving(false); }
  }
  function download() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `plant-locations-${today()}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function saveName() {
    if (!storageReady || storageBlocked || !nameDraft.trim() || savingNow.current) return;
    savingNow.current = true; setSaving(true);
    try {
      if (persistence === "notion") {
        const signature = `${location}:${nameDraft.trim()}`;
        if (renameOperation.current?.signature !== signature) renameOperation.current = { signature, id: crypto.randomUUID() };
        const response = await fetch("/api/location-logs", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locationId: location, name: nameDraft.trim(), operationId: renameOperation.current.id }) });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || "이름을 저장하지 못했어요.");
        setState((current) => ({ ...current, labels: { ...current.labels, [location]: nameDraft.trim() } }));
        renameOperation.current = null; setEditingName(false); setError(""); setMessage("공간 이름을 노션에 저장했어요.");
        return;
      }
      const latest = parseLocationState(window.localStorage.getItem(LOCATION_STORAGE_KEY));
      const next = { ...latest, labels: { ...latest.labels, [location]: nameDraft.trim().slice(0, 40) } };
      window.localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(next));
      setState(next); setEditingName(false); setError(""); setMessage("공간 이름을 변경했어요.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "공간 이름을 저장하지 못했어요."); }
    finally { savingNow.current = false; setSaving(false); }
  }

  return <main className="spaces-page">
    <header className="spaces-header"><Link href="/" aria-label="식물페이지로 돌아가기" className="icon-button"><ArrowLeft size={21} /></Link><span>나의 식물방</span><button type="button" className="icon-button" onClick={download} title="위치 기록 백업" aria-label="위치 기록 백업"><Download size={19} /></button></header>
    <div className="spaces-intro"><div><p className="spaces-eyebrow">MY PLANT ROOM</p><h1>초록이들의 자리</h1></div><span className="spaces-trial">{persistence === "notion" ? "나의 공간" : persistence === "local" ? "시험 공간" : "연결 확인"}</span></div>
    <PlantRoomIsometric selected={location} onSelect={selectLocation} counts={counts} labels={state.labels} />
    <div className="spaces-note"><span className="spaces-note-dot" />{persistence === "notion" ? "식물 세팅 변경 기록 DB와 연결되어 있어요" : persistence === "local" ? "개발 시험용 · 이 기기에만 저장돼요" : persistence === "error" ? "노션 연결을 확인해주세요" : "노션 위치 기록을 가져오고 있어요"}</div>
    <div className="spaces-body">
      <div className="spaces-group-tabs" aria-label="선반 선택">{LOCATION_GROUPS.map((item) => <button type="button" key={item.id} aria-pressed={group.id === item.id} onClick={() => selectLocation(`${item.id}:1`)}>{item.name}</button>)}</div>
      <section aria-label="선반 공간">
        <div className="spaces-section-heading"><div><h2>{group.name}</h2><p>{group.description}</p></div><Layers3 size={20} color="#919aa6" /></div>
        <div className="spaces-levels">{LOCATIONS.filter((item) => item.groupId === group.id).toReversed().map((item) => <div className="spaces-level-row" key={item.id} data-selected={location === item.id}>
          <button type="button" className="spaces-level-select" aria-pressed={location === item.id} onClick={() => selectLocation(item.id)}><span className="spaces-level-number">{item.level}</span><span>{state.labels?.[item.id] || item.name}</span><span className="spaces-level-count">{counts[item.id] || 0}개</span></button>
          <button type="button" className="spaces-level-open" aria-label={`${locationLabel(item.id)} 식물 카드 보기`} aria-expanded={cardsOpen && location === item.id} onClick={() => openCards(item.id)}><ArrowRight size={17} /></button>
        </div>)}</div>
        <div className="spaces-rename">{editingName ? <form onSubmit={(event) => { event.preventDefault(); saveName(); }}><input autoFocus aria-label="공간 이름" value={nameDraft} maxLength={40} onChange={(event) => setNameDraft(event.target.value)} /><button type="submit" className="icon-button" aria-label="공간 이름 저장" disabled={!nameDraft.trim() || storageBlocked}><Check size={17} /></button><button type="button" className="icon-button" aria-label="이름 변경 취소" onClick={() => setEditingName(false)}><X size={17} /></button></form> : <button type="button" onClick={() => { setNameDraft(state.labels?.[location] || chosenLocation.name); setEditingName(true); }} disabled={!storageReady || storageBlocked}><Pencil size={13} />선택한 공간 이름 변경</button>}</div>
      </section>
      <section className="spaces-plants" aria-label="공간별 식물">
        <div className="spaces-section-heading"><h2>{scope === "unassigned" ? "아직 자리가 없는 식물" : scope === "all" ? "전체 식물" : state.labels?.[location] || chosenLocation.name}</h2><span>{loading ? "불러오는 중" : `${displayed.length}개`}</span></div>
        <div className="spaces-scope" role="group" aria-label="식물 목록 범위">
          <button type="button" aria-pressed={scope === location} onClick={() => changeScope(location)}>이 공간 {counts[location] || 0}</button>
          <button type="button" aria-pressed={scope === "unassigned"} onClick={() => changeScope("unassigned")}>위치 미지정 {unassigned}</button>
          <button type="button" aria-pressed={scope === "all"} onClick={() => changeScope("all")}>전체</button>
        </div>
        <div className="spaces-search"><Search size={17} /><input aria-label="이동할 식물 검색" placeholder="어떤 식물을 옮길까요?" value={query} onChange={(event) => setQuery(event.target.value)} />{query ? <button type="button" onClick={() => setQuery("")} aria-label="검색어 지우기"><X size={17} /></button> : null}</div>
        {sourceError ? <p role="alert" className="spaces-error">{sourceError}</p> : null}
        {displayed.length ? <div className="spaces-selection"><span>{selected.length}개 선택</span><button type="button" onClick={() => setSelected((current) => allChecked ? current.filter((id) => !displayed.some((plant) => plant.id === id)) : [...new Set([...current, ...displayed.map((plant) => plant.id)])])}>{allChecked ? "전체 해제" : "전체 선택"}</button></div> : null}
        <div className="spaces-plant-list">{displayed.map((plant) => <label key={plant.id} className="spaces-plant-row"><input type="checkbox" checked={selected.includes(plant.id)} onChange={() => toggle(plant.id)} /><span className="spaces-checkbox" aria-hidden="true">{selected.includes(plant.id) ? <Check size={15} /> : null}</span><span className="spaces-plant-identity"><strong>{plant.name}</strong><small>{plant.category} · {locationLabel(state.positions[plant.id])}</small></span></label>)}</div>
        {!loading && !displayed.length && !sourceError ? <div className="spaces-empty"><MapPin size={25} /><p>{query ? "검색 결과가 없어요." : "이 공간에 배치된 식물이 없어요."}</p><button type="button" onClick={() => changeScope("unassigned")}>미지정 식물에서 배치하기 <ArrowRight size={14} /></button></div> : null}
      </section>
      {message ? <p role="status" className="spaces-success"><Check size={16} />{message}</p> : null}
      {saveResults.length ? <div className="spaces-save-results" aria-label="식물별 위치 저장 결과">{saveResults.map((result) => <p key={result.plantId} className={result.success ? "spaces-success" : "spaces-error"}>{plants.find((plant) => plant.id === result.plantId)?.name} · {result.success ? "저장 완료" : result.message || "저장 확인 필요"}</p>)}</div> : null}
      {error && !moving ? <p role="alert" className="spaces-error">{error}</p> : null}
      <section className="spaces-history"><button type="button" className="spaces-history-toggle" aria-expanded={historyOpen} onClick={() => setHistoryOpen(!historyOpen)}><History size={18} /><span>이동 기록</span><small>{state.history.length}건</small><ChevronDown size={17} style={{ transform: historyOpen ? "rotate(180deg)" : undefined }} /></button>{historyOpen ? <div>{state.history.length ? state.history.map((record) => <article key={record.id}><time>{record.date}</time><strong>{record.plantName}</strong><p>{locationLabel(record.from)} <ArrowRight size={12} /> {locationLabel(record.to)}</p>{record.reason ? <small>{record.reason}</small> : null}</article>) : <p className="spaces-history-empty">아직 이동 기록이 없어요.</p>}</div> : null}</section>
    </div>
    {cardsOpen ? <section role="dialog" aria-modal="true" aria-label="공간 안의 식물 카드" className="spaces-cards-screen">
      <header className="spaces-cards-header"><button ref={cardsBack} type="button" className="icon-button" aria-label="식물방으로 돌아가기" onClick={() => setCardsOpen(false)}><ArrowLeft size={21} /></button><h2>{locationLabel(location)}</h2><span>{counts[location] || 0}개</span></header>
      <div className="spaces-cards-body"><h3>이 공간의 식물</h3>
        <div className="spaces-cards-grid">{plants.filter((plant) => state.positions[plant.id] === location).map((plant) => <Link key={plant.id} href={`/?plant=${encodeURIComponent(plant.id)}`} prefetch={false} className="spaces-profile-card" aria-label={`${plant.name} 내 식물 상세 보기`}>
          <PlantCoverThumbnail src={plant.coverPhotoUrl} /><span><strong>{plant.name}</strong><small>{plant.category}</small></span><ArrowRight size={17} />
        </Link>)}</div>
        {!counts[location] ? <div className="spaces-empty"><MapPin size={26} /><p>아직 이 칸에 배치된 식물이 없어요.</p></div> : null}
      </div>
    </section> : null}
    {selected.length ? <div className="spaces-dock"><span><strong>{selected.length}</strong>개 선택</span><button type="button" disabled={!storageReady || storageBlocked} onClick={() => { setDestination(location); setDate(today()); setError(""); setMoving(true); }}>공간 이동 <ArrowRight size={18} /></button></div> : null}
    {moving ? <div className="spaces-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget && !savingNow.current) setMoving(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="move-title" className="spaces-modal">
        <fieldset disabled={saving}>
        <div className="spaces-section-heading"><h2 id="move-title">새로운 자리로</h2><button autoFocus type="button" className="icon-button" aria-label="이동 취소" onClick={() => setMoving(false)}><X size={20} /></button></div>
        <p className="spaces-moving-names">{selectedPlants.slice(0, 3).map((plant) => plant.name).join(", ")}{selected.length > 3 ? ` 외 ${selected.length - 3}개` : ""}</p>
        <label>옮길 공간<select value={destination} onChange={(event) => setDestination(event.target.value)}>{LOCATION_GROUPS.map((item) => <optgroup key={item.id} label={item.name}>{LOCATIONS.filter((zone) => zone.groupId === item.id).map((zone) => <option key={zone.id} value={zone.id}>{locationLabel(zone.id)}</option>)}</optgroup>)}</select></label>
        <label>이동 날짜<input type="date" value={date} max={today()} onChange={(event) => setDate(event.target.value)} /></label>
        <label>메모<textarea value={reason} maxLength={500} rows={2} placeholder="빛이 더 잘 드는 자리로 옮겼어요" onChange={(event) => setReason(event.target.value)} /></label>
        {error ? <p role="alert" className="spaces-error">{error}</p> : null}
        {saveResults.some((result) => !result.success) ? <div role="status" className="spaces-error">{saveResults.filter((result) => !result.success).map((result) => <p key={result.plantId}>{plants.find((plant) => plant.id === result.plantId)?.name} · {result.message || "저장 확인 필요"}</p>)}</div> : null}
        <button type="button" className="primary-button" disabled={!storageReady || storageBlocked || !date || saving} onClick={save}>{saving ? "노션에 저장 중..." : `${selected.length}개 식물 이동 기록`}</button>
        </fieldset>
      </section>
    </div> : null}
  </main>;
}
