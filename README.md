# ElectroSim Frontend Skeleton

ElectroSim is a React + TypeScript frontend prototype for drawing simple electrical circuits, solving them in DC or AC steady state, and inspecting the results visually.

This repository is best understood as a frontend skeleton:
- It already contains the interaction model for building and exploring circuits.
- It already contains a client-side simulation engine for DC and AC phasor analysis.
- It does not yet contain authentication, API integration, database persistence, or multi-user/project workflows.

That makes it a strong base for adapting into a larger website where login, saved projects, and backend-driven data will be added later.

## What The App Does Today

Users can:
- place components on a canvas
- connect them with wires
- switch between DC and AC analysis
- inspect voltages and currents
- open phasor views for AC analysis
- animate probe traces over time

Core supported parts:
- ground
- resistor
- capacitor
- inductor
- voltage source
- current source

## Stack

- React 19
- TypeScript
- Vite
- Zustand for lightweight UI/time state
- SVG rendering for the circuit canvas and charts

## Run The Project

```bash
npm install
npm run dev
```

Other scripts:

```bash
npm run build
npm run lint
```

## Project Structure

```text
src/
  components/
    canvas/      Visual circuit editor and entity rendering
    charts/      Trace plotting for probe results
    modals/      Probe and phasor dialogs
    panels/      Sidebar, editor, results, status UI
    phasor/      AC phasor visualization widgets
  engine/        Circuit solving and measurement logic
  hooks/         Local app behavior for circuit editing and input handling
  store/         Global UI/time state with Zustand
  types/         Shared domain types
  utils/         Geometry, parsing, formatting, entity helpers
  constants/     Canvas and default component configuration
```

## Architecture At A Glance

There are three main layers in this frontend:

1. Interaction layer
   The canvas, sidebar, dialogs, and keyboard/mouse handlers let the user build a circuit and inspect it.

2. Circuit state layer
   `useCircuit` owns the editable circuit model in memory: entities, wires, and selection.

3. Solver layer
   `solveDC`, `solveAC`, and `measurements` transform the current circuit into electrical results that the UI can render.

In practice, the data flow is:

```text
User input
  -> App.tsx event handlers
  -> useCircuit / Zustand stores
  -> entities + wires + analysis mode
  -> solveDC / solveAC
  -> measurement helpers
  -> canvas coloring, result panels, charts, phasor modal
```

## Key Files

- [`src/App.tsx`](/c:/electrosim/src/App.tsx)
  Main orchestrator. Wires together editing, solving, animation timing, and modal state.

- [`src/hooks/useCircuit.ts`](/c:/electrosim/src/hooks/useCircuit.ts)
  In-memory circuit editor state. This is the main place to replace or augment with backend persistence later.

- [`src/engine/solveDC.ts`](/c:/electrosim/src/engine/solveDC.ts)
  DC solver using Modified Nodal Analysis.

- [`src/engine/solveAC.ts`](/c:/electrosim/src/engine/solveAC.ts)
  AC steady-state solver in the phasor domain.

- [`src/engine/measurements.ts`](/c:/electrosim/src/engine/measurements.ts)
  Converts solver output into UI-facing values like probe readings, phasors, and instantaneous values.

- [`src/components/canvas/CircuitCanvas.tsx`](/c:/electrosim/src/components/canvas/CircuitCanvas.tsx)
  SVG scene for wires, components, hover states, and node visualization.

- [`src/components/panels/Sidebar.tsx`](/c:/electrosim/src/components/panels/Sidebar.tsx)
  Main control panel for tools, analysis settings, editing, and results.

## Mental Model For The Domain

The frontend currently models a circuit with:

- `Entity`: a placed component on the canvas
- `Wire`: a connection between two terminals
- `Terminal`: a connection point on a component
- `Selection`: current selected wire or component
- `Solution`: either a DC or AC result object

Important detail:
- `entities` and `wires` are the source of truth
- solver results are derived data, recalculated from that source of truth
- probe traces and phasor views are also derived data

This is useful when moving to a backend later: persist the editable circuit model, not the computed results.

## Current State Boundaries

There are two kinds of state in the app:

- Local React state in `App.tsx`
  Used for short-lived UI interactions such as pending wire connections, hovered terminal, open modals, and active probe selection.

- Zustand store state
  Used for cross-cutting UI state such as selected tool, analysis mode, AC frequency, animation time, and run/stop state.

The actual circuit graph itself is still local to `useCircuit`.

## How The Solver Works

### DC

`solveDC`:
- builds node connectivity from wires and terminals
- checks for ground
- stamps component behavior into an MNA matrix
- solves the linear system
- returns node voltages and source currents

Special cases:
- capacitors are ignored in DC steady state
- inductors are modeled as 0 V branches so current can still be measured

### AC

`solveAC`:
- determines the working AC frequency
- converts components into complex admittances or source phasors
- solves the complex MNA system
- returns node voltages, source currents, and angular frequency

Special cases:
- all AC sources must share one frequency
- DC current sources do not contribute in AC mode
- DC voltage sources become 0 V constraints in AC mode

## Adapting This Into A Full Website

For the next phase, the cleanest approach is to treat this repo as the circuit workspace module inside a larger app shell.

Recommended evolution:

1. Add authentication around the workspace
   Examples: login page, route guards, user profile context, token/session handling.

2. Replace local-only circuit state with backend-backed project loading/saving
   Persist `entities`, `wires`, and user/project metadata.

3. Keep solving on the frontend first unless backend solving becomes necessary
   For small circuits, the current client-side solver is simple and fast.

4. Introduce an API layer
   Centralize fetch logic instead of calling backend code from UI components directly.

5. Separate workspace state from server state
   Local unsaved edits and remote persisted project data should remain distinct.

## Suggested Backend Contract

If this becomes part of another website, a backend-friendly project shape could look like:

```ts
type CircuitProjectDto = {
  id: string;
  ownerId: string;
  name: string;
  description?: string;
  entities: Entity[];
  wires: Wire[];
  analysis: "dc" | "ac";
  acFreq: string;
  updatedAt: string;
};
```

Keep solver output out of the database unless you have a specific caching/reporting need.

## Recommended Next Refactor

If the team plans to integrate login and APIs soon, the highest-value refactor is:

- move circuit data from `useCircuit` into a dedicated workspace store or provider
- define serializable DTOs for loading/saving projects
- add an API service layer
- keep `App.tsx` focused on composition rather than owning so much orchestration directly

## Documentation Map

For a deeper walkthrough, see:

- [`docs/architecture.md`](/c:/electrosim/docs/architecture.md)

## Known Limitations

- no authentication
- no persistence
- no routing
- no backend integration
- no collaboration or project management layer
- solver is intentionally lightweight and aimed at simple circuits

## Team Onboarding Tip

If someone is new to the codebase, the best reading order is:

1. [`src/types/index.ts`](/c:/electrosim/src/types/index.ts)
2. [`src/App.tsx`](/c:/electrosim/src/App.tsx)
3. [`src/hooks/useCircuit.ts`](/c:/electrosim/src/hooks/useCircuit.ts)
4. [`src/engine/solveDC.ts`](/c:/electrosim/src/engine/solveDC.ts)
5. [`src/engine/solveAC.ts`](/c:/electrosim/src/engine/solveAC.ts)
6. [`src/engine/measurements.ts`](/c:/electrosim/src/engine/measurements.ts)
