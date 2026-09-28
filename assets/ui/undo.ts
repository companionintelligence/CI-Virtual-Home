// Undo and redo for the editor's own operations (plan §6 P2 12): adding, deleting, duplicating, moving and
// re-finishing things. Each operation pushes { label, undo, redo }; Cmd/Ctrl-Z undoes, Shift-Cmd/Ctrl-Z redoes.
// Building another home or clearing the scene clears the history (the objects it held are gone).

export type Op = { label: string; undo: () => void; redo: () => void; drop?: () => void };

export function createUndo({ limit = 100, onChange }: { limit?: number; onChange?: (s: { canUndo: boolean; canRedo: boolean; undoLabel: string | null; redoLabel: string | null }) => void } = {}) {
  const done: Op[] = [], undone: Op[] = [];
  const emit = () => onChange?.({ canUndo: done.length > 0, canRedo: undone.length > 0, undoLabel: done.at(-1)?.label ?? null, redoLabel: undone.at(-1)?.label ?? null });
  return {
    push(op: Op) {
      done.push(op);
      for (const o of undone.splice(0)) o.drop?.();
      while (done.length > limit) done.shift()!.drop?.();
      emit();
    },
    undo(): Op | null { const op = done.pop(); if (!op) return null; op.undo(); undone.push(op); emit(); return op; },
    redo(): Op | null { const op = undone.pop(); if (!op) return null; op.redo(); done.push(op); emit(); return op; },
    clear() { for (const o of [...done, ...undone]) o.drop?.(); done.length = 0; undone.length = 0; emit(); },
    get size() { return { done: done.length, undone: undone.length }; },
  };
}
