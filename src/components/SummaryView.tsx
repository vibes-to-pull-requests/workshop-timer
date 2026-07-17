import { useRef, useState } from "react";

import { formatSignedDuration, formatTimerValue } from "../domain/timer";
import type { CompletedState } from "../domain/types";
import ConfirmDialog from "./ConfirmDialog";

interface SummaryViewProps {
  readonly state: CompletedState;
  readonly onNewPlan: () => void;
}

export default function SummaryView({ state, onNewPlan }: SummaryViewProps) {
  const [confirming, setConfirming] = useState(false);
  const newPlanRef = useRef<HTMLButtonElement>(null);

  return (
    <section className="summary-view" aria-labelledby="summary-title">
      <div className="summary-intro">
        <p className="eyebrow">Workshop complete</p>
        <h1 id="summary-title">How the time was used</h1>
        <p>Compare your original plan with the active time recorded for each segment.</p>
      </div>

      <div className="summary-table-wrap">
        <table className="summary-table">
          <caption className="sr-only">Planned and actual workshop timing</caption>
          <thead>
            <tr><th scope="col">Segment</th><th scope="col">Planned</th><th scope="col">Actual</th><th scope="col">Difference</th></tr>
          </thead>
          <tbody>
            {state.summary.segments.map((segment) => (
              <tr key={segment.segmentId}>
                <th scope="row">{segment.name}</th>
                <td>{formatElapsed(segment.plannedMs)}</td>
                <td>{formatElapsed(segment.actualMs)}</td>
                <td><Variance value={segment.varianceMs} /></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              <td>{formatElapsed(state.summary.plannedTotalMs)}</td>
              <td>{formatElapsed(state.summary.actualTotalMs)}</td>
              <td><Variance value={state.summary.varianceTotalMs} /></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="summary-actions">
        <p>This summary stays in this browser until you start a new plan.</p>
        <button ref={newPlanRef} type="button" onClick={() => setConfirming(true)}>New plan</button>
      </div>

      {confirming ? (
        <ConfirmDialog
          title="Start a new plan?"
          description="This replaces the completed workshop and its summary with a blank plan."
          cancelLabel="Keep summary"
          confirmLabel="Start new plan"
          returnFocusRef={newPlanRef}
          onCancel={() => setConfirming(false)}
          onConfirm={onNewPlan}
        />
      ) : null}
    </section>
  );
}

function Variance({ value }: { readonly value: number }) {
  if (value === 0) return <span className="variance on-plan">On plan</span>;
  const label = value > 0 ? "overtime" : "under plan";
  return <span className={`variance ${value > 0 ? "over" : "under"}`}>{formatSignedDuration(Math.abs(value)).replace("+", "")} {label}</span>;
}

function formatElapsed(durationMs: number): string {
  return formatTimerValue(Math.max(0, durationMs));
}
