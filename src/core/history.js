/**
 * Command pattern + undo/redo history stack.
 *
 * A command is any object exposing:
 *   do(context): void      — apply the change (also used for redo)
 *   undo(context): void    — revert the change
 *   label: string          — human-readable description (debug/UI)
 *
 * The HistoryManager owns an execution context (typically the store's commit
 * callback) and keeps two stacks bounded by `limit` to cap memory.
 *
 * Transient gestures (drag / resize / pan) must NOT push per frame: tools
 * record a single command on pointer-up via `pushTransient()` semantics —
 * i.e. they call `execute()` exactly once with the final delta.
 */

const DEFAULT_LIMIT = 100;

export class HistoryManager {
  /**
   * @param {{ limit?: number, context?: Object }} opts
   *  - limit: max undo steps kept (memory bound)
   *  - context: argument passed to every command's do()/undo()
   */
  constructor({ limit = DEFAULT_LIMIT, context = null } = {}) {
    this.limit = Math.max(1, limit);
    this.context = context;
    /** @type {Array<Object>} */
    this.undoStack = [];
    /** @type {Array<Object>} */
    this.redoStack = [];
  }

  /** Run a command and remember it for undo. */
  execute(command) {
    command.do(this.context);
    this.undoStack.push(command);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack.length = 0;
    return command;
  }

  /**
   * Record an already-applied command without re-running it.
   * Used when a gesture applied live preview changes and wants the final
   * state committed as one history entry.
   */
  record(command) {
    this.undoStack.push(command);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack.length = 0;
  }

  get canUndo() {
    return this.undoStack.length > 0;
  }

  get canRedo() {
    return this.redoStack.length > 0;
  }

  undo() {
    const command = this.undoStack.pop();
    if (!command) return null;
    command.undo(this.context);
    this.redoStack.push(command);
    return command;
  }

  redo() {
    const command = this.redoStack.pop();
    if (!command) return null;
    command.do(this.context);
    this.undoStack.push(command);
    return command;
  }

  clear() {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}

/* ------------------------------------------------------------------ */
/* Ready-made commands built on document snapshots                     */
/* ------------------------------------------------------------------ */

/**
 * Snapshot-based command: captures `before`/`after` plain-document states.
 * Simple, correct, and cheap enough for MVP-sized documents. Fine-grained
 * diff commands can replace these later without touching callers.
 *
 * @param {string} label
 * @param {Object} before deep-copied prior document
 * @param {Object} after  deep-copied next document
 * @param {(doc:Object)=>void} restore called with each snapshot
 */
export function snapshotCommand(label, before, after, restore) {
  return {
    label,
    do() {
      restore(after);
    },
    undo() {
      restore(before);
    },
  };
}

/**
 * Build a snapshot command from a "produce" style mutation:
 *   run("Add rectangle", doc => { ...mutate draft... })
 * The helper clones the current document, applies the mutator to the clone,
 * and records before/after restores through `commit`.
 *
 * @param {string} label
 * @param {Object} current plain document (source of truth snapshot)
 * @param {(draft:Object)=>void} mutate receives a deep-cloned draft
 * @param {(doc:Object)=>void} commit installs a document snapshot
 * @param {()=>boolean} [live] when true, `current` was already mutated —
 *        only the inverse snapshot is captured for undo.
 */
export function produceCommand(label, current, mutate, commit) {
  const before = structuredCloneSafe(current);
  const after = structuredCloneSafe(current);
  mutate(after);
  commit(after);
  return snapshotCommand(label, before, after, commit);
}

function structuredCloneSafe(obj) {
  if (typeof structuredClone === 'function') return structuredClone(obj);
  return JSON.parse(JSON.stringify(obj));
}
