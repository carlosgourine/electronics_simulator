import type { Entity, Wave } from "../../types";

type EditorProps = {
  entity: Entity;
  updateSelected: (patch: Partial<Entity>) => void;
};

export function Editor({ entity, updateSelected }: EditorProps) {
  const isSource = entity.type === "vsrc" || entity.type === "isrc";
  const isPassive = entity.type === "resistor" || entity.type === "capacitor" || entity.type === "inductor";

  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-2">
        <div className="w-20 opacity-70">Label</div>
        <input
          className="flex-1 rounded border border-white/10 bg-black/20 px-2 py-1"
          value={entity.label || ""}
          onChange={(event) => updateSelected({ label: event.currentTarget.value })}
        />
      </div>

      {isPassive && (
        <div className="flex items-center gap-2">
          <div className="w-20 opacity-70">Value</div>
          <input
            className="flex-1 rounded border border-white/10 bg-black/20 px-2 py-1"
            placeholder={entity.type === "resistor" ? "1kohm" : entity.type === "capacitor" ? "1uF" : "10mH"}
            value={entity.value || ""}
            onChange={(event) => updateSelected({ value: event.currentTarget.value })}
          />
        </div>
      )}

      {isSource && (
        <>
          <div className="flex items-center gap-2">
            <div className="w-20 opacity-70">Wave</div>
            <select
              className="flex-1 rounded border border-white/10 bg-black/20 px-2 py-1"
              value={entity.wave || "dc"}
              onChange={(event) => updateSelected({ wave: event.currentTarget.value as Wave })}
            >
              <option value="dc">DC</option>
              <option value="ac">AC</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-20 opacity-70">Amplitude</div>
            <input
              className="flex-1 rounded border border-white/10 bg-black/20 px-2 py-1"
              placeholder={entity.type === "vsrc" ? "5V" : "10mA"}
              value={entity.amplitude || ""}
              onChange={(event) => updateSelected({ amplitude: event.currentTarget.value })}
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="w-20 opacity-70">Frequency</div>
            <input
              className="flex-1 rounded border border-white/10 bg-black/20 px-2 py-1"
              placeholder="1kHz"
              value={entity.frequency || ""}
              onChange={(event) => updateSelected({ frequency: event.currentTarget.value })}
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(entity.phaseEnabled)}
                onChange={(event) => updateSelected({ phaseEnabled: event.currentTarget.checked })}
              />
              Use phase
            </label>
            <input
              className="flex-1 rounded border border-white/10 bg-black/20 px-2 py-1"
              placeholder="30deg"
              disabled={!entity.phaseEnabled}
              value={entity.phase || ""}
              onChange={(event) => updateSelected({ phase: event.currentTarget.value })}
            />
          </div>
        </>
      )}
    </div>
  );
}
