import type { CSSProperties } from "react";

import type { TimerSwarmCell } from "../domain/timerUrgency";

interface TimerSwarmProps {
  readonly value: string;
  readonly cells: readonly TimerSwarmCell[];
}

export default function TimerSwarm({ value, cells }: TimerSwarmProps) {
  return (
    <div className="timer-swarm-field">
      {cells.map((cell, index) => (
        <span
          key={index}
          className="timer-swarm-cell"
          style={{
            "--cell-x": cell.x,
            "--cell-y": cell.y,
          } as CSSProperties}
          aria-hidden={index === 0 ? undefined : true}
        >
          <span
            className="timer-swarm-cell-value"
            data-testid={index === 0 ? "timer-value" : undefined}
            role={index === 0 ? "timer" : undefined}
            aria-live={index === 0 ? "off" : undefined}
          >
            {value}
          </span>
        </span>
      ))}
    </div>
  );
}