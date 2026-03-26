# Architecture Walkthrough

This document explains how the current frontend hangs together so the team can safely extend it into a larger product.

## 1. Big Picture

The app is a single-page circuit workspace with three responsibilities:

- editing a circuit on an SVG canvas
- solving the circuit in DC or AC mode
- presenting measurements and visualizations from the solver output

Today, everything lives on the frontend. There is no backend boundary yet.

## 2. Main Runtime Flow

The runtime loop centers around [`App.tsx`](/c:/electrosim/src/App.tsx).

`App.tsx` is responsible for:
- owning temporary interaction state
- connecting UI state from Zustand
- invoking the solver
- translating user input into circuit edits
- feeding the results into panels, modals, and charts

The rough lifecycle per render is:

```text
entities/wires/UI settings change
  -> DC and AC solutions are recomputed with useMemo
  -> active solution is selected based on analysis mode
  -> UI reads derived values from the solution
```

This means solving is purely derived from the current workspace state. There is no async fetching or command queue involved yet.

## 3. State Ownership

### Circuit Editing State

[`src/hooks/useCircuit.ts`](/c:/electrosim/src/hooks/useCircuit.ts) owns:
- `entities`
- `wires`
- `selected`

It also exposes editing operations:
- add entity
- move entity
- update entity
- snap entity to grid
- add wire
- delete entity
- delete wire

This hook is currently the closest thing to a workspace store.

### UI Store

[`src/store/useUIStore.ts`](/c:/electrosim/src/store/useUIStore.ts) owns small global UI settings:
- active tool
- active analysis mode
- node debug visibility
- AC frequency text

### Time Store

[`src/store/useTimeStore.ts`](/c:/electrosim/src/store/useTimeStore.ts) owns:
- animation time `t`
- whether the simulation is running

This is used mainly for animated probe traces and time-based AC visualization.

### Local App State

`App.tsx` still owns a set of transient interaction states:
- `pendingWire`
- `hoverTerm`
- `probeData`
- modal open/close flags
- phasor mode

These are tightly coupled to the current page and can stay local unless the app grows more complex.

## 4. Rendering Layer

### Canvas

[`src/components/canvas/CircuitCanvas.tsx`](/c:/electrosim/src/components/canvas/CircuitCanvas.tsx) renders:
- background grid
- wires
- current temporary wire preview
- components through `EntityView`
- hovered terminals
- optional node IDs

This component is intentionally mostly presentational. Input decisions still come from `App.tsx`.

### Sidebar

[`src/components/panels/Sidebar.tsx`](/c:/electrosim/src/components/panels/Sidebar.tsx) is the workspace control center:
- palette/tool selection
- DC/AC mode switching
- AC frequency input
- run/stop toggle
- selected component editor
- result preview

### Modals And Charts

- `ProbeModal` shows live measurements for a selected node/component
- `SmoothTrace` builds chart points from solver output over time
- `TraceChart` renders the actual chart and now supports pause/freeze inspection
- `PhasorModal` and `phasor/*` render AC phasor views

## 5. Solver Layer

### Node Mapping

[`src/engine/nodes.ts`](/c:/electrosim/src/engine/nodes.ts) converts wires and component terminals into node IDs.

This is foundational because both solvers need a stable mapping from terminal IDs to electrical nodes.

### Matrix Solvers

[`src/engine/matrix.ts`](/c:/electrosim/src/engine/matrix.ts) contains:
- `solveLinear` for real-valued systems
- `solveLinearC` for complex-valued systems

These are low-level numeric helpers used by the circuit solvers.

### DC Solver

[`src/engine/solveDC.ts`](/c:/electrosim/src/engine/solveDC.ts) performs DC steady-state analysis with Modified Nodal Analysis.

High-level flow:
- map terminals to nodes
- allocate MNA matrices
- stamp each supported component type
- solve the resulting linear system
- package voltages and source currents into a `DCSolution`

### AC Solver

[`src/engine/solveAC.ts`](/c:/electrosim/src/engine/solveAC.ts) performs steady-state AC analysis in the phasor domain.

High-level flow:
- derive the active frequency
- convert components to complex admittances or source phasors
- stamp the complex MNA system
- solve it
- return an `ACSolution`

## 6. Measurement Layer

[`src/engine/measurements.ts`](/c:/electrosim/src/engine/measurements.ts) is the adapter between solver math and UI needs.

It answers questions like:
- what is the voltage across this component?
- what is the current through this component?
- what is the instantaneous value at time `t`?
- which phasors should be shown in the modal?

This layer is important because most UI components should not need to know solver internals.

## 7. Utilities

The utility layer contains reusable helpers:

- [`src/utils/entities.ts`](/c:/electrosim/src/utils/entities.ts)
  Creates entities, labels, and terminal positions.

- [`src/utils/parser.ts`](/c:/electrosim/src/utils/parser.ts)
  Parses engineering inputs like `1kHz`, `10mA`, and `30deg`.

- [`src/utils/geometry.ts`](/c:/electrosim/src/utils/geometry.ts)
  Mouse positions, snapping, hit-testing, colors, and geometric helpers.

- [`src/utils/formatters.ts`](/c:/electrosim/src/utils/formatters.ts)
  Formats values for display.

## 8. What To Preserve During Integration

When embedding this into a larger website, preserve these boundaries:

- UI components should continue receiving already-prepared data
- measurement helpers should remain the main adapter between solver and UI
- circuit project data should stay serializable
- backend APIs should deal with persisted project state, not DOM-specific concerns

## 9. Where Login And Backend Should Fit

The cleanest future layout is:

```text
App shell / routes
  -> auth provider
  -> project loader
  -> circuit workspace page
      -> workspace store
      -> solver hooks/selectors
      -> canvas/sidebar/modals
```

Suggested responsibilities:

- Auth layer
  Handles login, session, and route protection.

- API layer
  Handles `getProject`, `createProject`, `updateProject`, `listProjects`.

- Workspace state layer
  Holds loaded project data, dirty state, save status, and optimistic edits.

- Solver layer
  Remains mostly unchanged and consumes current circuit data.

## 10. Practical Refactor Sequence

To evolve this safely, the team could work in this order:

1. Extract a `CircuitWorkspaceProvider` or Zustand workspace store.
2. Move `entities` and `wires` into that shared workspace state.
3. Add project serialization and deserialization.
4. Add API services.
5. Add routing and authenticated pages.
6. Keep the solver pure and frontend-local until product needs require backend execution.

## 11. Current Risks / Technical Debt

- `App.tsx` is doing a lot of orchestration and will become harder to maintain as features grow.
- There is no persistence boundary yet, so save/load concerns are not separated from editing concerns.
- Some display strings show encoding artifacts from earlier text input; that can be cleaned up later without changing architecture.
- The solver assumes a relatively small, in-memory circuit and does not yet target large-scale simulation workloads.

## 12. Summary

The codebase already has a healthy split between:
- rendering
- editing state
- solver logic
- measurement adapters

That is exactly why it is a good frontend skeleton. The main missing pieces are product-platform concerns like authentication, server persistence, routing, and project lifecycle management.
