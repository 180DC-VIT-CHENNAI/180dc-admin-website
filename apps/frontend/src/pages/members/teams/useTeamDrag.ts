import { useEffect, useState } from "react";
import type { DragEvent } from "react";
import type { MemberKind } from "./treeUtils";

// Native HTML5 drag-and-drop — no library. Two things are draggable:
//   * a member chip, dropped onto another team card
//   * a team card, dropped onto a group header (reassign) or another team (reorder)

export type DragPayload =
  // `fromTeamId: null` means the card came from the available-people rail, so
  // dropping it on a column is an ADD rather than a move between teams.
  | { type: "member"; kind: MemberKind; memberId: string; fromTeamId: string | null; instanceId: string; name: string }
  | { type: "team"; teamId: string; fromGroupId: string | null; instanceId: string; name: string }
  // A team being dragged along the level ladder on the progress board.
  | { type: "teamLevel"; teamId: string; fromLevel: number; instanceId: string; name: string };

// Must stay lowercase: dataTransfer.types is normalised to lowercase, and that
// is the only thing readable during dragover (getData is blocked until drop).
const MIME = "application/x-180dc-teams";

let activeDrag: DragPayload | null = null;
const listeners = new Set<() => void>();

function publish(next: DragPayload | null) {
  activeDrag = next;
  listeners.forEach((fn) => fn());
}

/**
 * The payload currently being dragged, or null. Lets a drop target style itself
 * *before* the drop — e.g. a full team can grey itself out mid-drag, since the
 * payload itself is unreadable until the drop event fires.
 */
export function useActiveDrag(): DragPayload | null {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);
  return activeDrag;
}

export function startDrag(e: DragEvent, payload: DragPayload) {
  e.dataTransfer.setData(MIME, JSON.stringify(payload));
  // Safari refuses to start a drag without a text/plain entry.
  e.dataTransfer.setData("text/plain", payload.name);
  e.dataTransfer.effectAllowed = "move";
  publish(payload);
}

export function finishDrag() {
  publish(null);
}

export function readDrag(e: DragEvent): DragPayload | null {
  try {
    const raw = e.dataTransfer.getData(MIME);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Whether this drag carries our payload at all (safe to call during dragover). */
export function isOurDrag(e: DragEvent): boolean {
  return Array.from(e.dataTransfer.types || []).includes(MIME);
}

/**
 * Drop-target wiring. `accept` decides — from the live payload — whether this
 * target can take the drop; rejected targets never highlight and never fire.
 */
export function useDropTarget(accept: (p: DragPayload) => boolean, onDrop: (p: DragPayload) => void) {
  const [over, setOver] = useState(false);
  const drag = useActiveDrag();
  const canAccept = drag ? accept(drag) : false;

  return {
    isOver: over && canAccept,
    canAccept,
    // What kind of thing is in flight right now (null when nothing is), so a
    // target can dim itself when it cannot accept the current drag.
    activeType: drag ? drag.type : null,
    handlers: {
      onDragOver: (e: DragEvent) => {
        if (!isOurDrag(e) || !canAccept) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (!over) setOver(true);
      },
      onDragLeave: (e: DragEvent) => {
        // Ignore bubbling from children re-entering the same target.
        if (e.currentTarget instanceof Node && e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) return;
        setOver(false);
      },
      onDrop: (e: DragEvent) => {
        setOver(false);
        if (!isOurDrag(e)) return;
        e.preventDefault();
        e.stopPropagation();
        const payload = readDrag(e);
        if (payload && accept(payload)) onDrop(payload);
        finishDrag();
      },
    },
  };
}
