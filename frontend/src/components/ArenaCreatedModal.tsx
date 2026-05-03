type ArenaCreatedModalProps = {
  open: boolean;
  arenaId: string;
  arenaSize: number;
  onDismiss: () => void;
  /** Same as toolbar [RUN_ARENA]; modal closes first, then the run proceeds in the background. */
  onRunArena: () => void | Promise<void>;
};

export function ArenaCreatedModal({ open, arenaId, arenaSize, onDismiss, onRunArena }: ArenaCreatedModalProps) {
  if (!open) {
    return null;
  }

  const handleRun = () => {
    onDismiss();
    void onRunArena();
  };

  return (
    <div
      className="arena-created-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onDismiss();
        }
      }}
    >
      <div className="arena-created-modal" role="dialog" aria-labelledby="arena-created-title">
        <div id="arena-created-title" className="arena-created-modal-title">
          ARENA_CREATED
        </div>
        <pre className="arena-created-modal-block">
          ARENA_ID&nbsp;&nbsp; :: {arenaId}
          {"\n"}
          ARENA_SIZE :: {arenaSize}
          {"\n"}
          STATUS&nbsp;&nbsp;&nbsp;&nbsp; :: READY
        </pre>
        <button className="button button-primary arena-created-modal-primary" type="button" onClick={handleRun}>
          [RUN_ARENA]
        </button>
        <button className="button arena-created-modal-secondary" type="button" onClick={onDismiss}>
          [DISMISS]
        </button>
      </div>
    </div>
  );
}
