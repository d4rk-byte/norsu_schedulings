# Faculty Dashboard Layout Shift Refactor Plan

Date: 2026-04-20

## Objective
Reduce layout shift (CLS) and UI jank in the faculty dashboard by synchronizing async rendering and reserving stable layout space before data resolves.

## Scope
- Frontend/src/app/faculty/dashboard/page.tsx

## Refactor Plan (Line-by-Line)

1. Make pending count state support unknown initial value.
Location: Frontend/src/app/faculty/dashboard/page.tsx#L38  
Change pending schedule count from always numeric to nullable, so loading can be distinguished from actual zero.

2. Combine initial dashboard and pending-count fetch.
Location: Frontend/src/app/faculty/dashboard/page.tsx#L48  
In the initial loader, fetch both dashboard data and pending request count together (Promise.all).  
Result: first visible render is consistent across cards, list, and quick actions.

3. Keep a single mount-triggered initial load path.
Location: Frontend/src/app/faculty/dashboard/page.tsx#L61  
Use the existing mount effect to trigger only the unified initial loader.

4. Convert second effect to polling-only behavior.
Location: Frontend/src/app/faculty/dashboard/page.tsx#L66  
Remove the immediate pending-count fetch call from this effect and keep interval refresh only.  
This avoids a second startup request that can cause delayed badge insertion.

5. Replace full-page spinner with a layout-preserving shell.
Location: Frontend/src/app/faculty/dashboard/page.tsx#L96  
Instead of rendering only a centered spinner on first load, render the same dashboard structure with placeholders/skeletons.  
Result: no major reflow from tiny-spinner view to full dashboard view.

6. Reserve fixed stat value area in cards.
Location: Frontend/src/app/faculty/dashboard/page.tsx#L289  
Ensure the value row has stable min-height and min-width so spinner-to-number replacement does not move surrounding content.

7. Stabilize schedule panel loading/content swap.
Locations:  
- Frontend/src/app/faculty/dashboard/page.tsx#L317  
- Frontend/src/app/faculty/dashboard/page.tsx#L329  
Keep skeleton row dimensions aligned with real rows and set panel min-height to reduce vertical jump when data appears.

8. Always reserve quick-action badge slot.
Locations:  
- Frontend/src/app/faculty/dashboard/page.tsx#L373  
- Frontend/src/app/faculty/dashboard/page.tsx#L384  
Render a persistent badge container for each row and hide content when count is empty.  
Result: Arrow icon position stays stable.

9. Keep error handling inline without structural swap.
Location: Frontend/src/app/faculty/dashboard/page.tsx#L104  
Retain in-layout error display so transient errors do not replace the whole dashboard structure and trigger large shifts.

## Acceptance Criteria

1. Initial page paint does not switch from a minimal spinner view to a full dashboard layout.
2. Quick Actions rows keep identical alignment whether pending badge is present or not.
3. Stat cards do not jump when values replace loading indicators.
4. Today's Schedule panel height remains visually stable between loading, empty, and populated states.
5. Initial data appears in one coordinated pass, with only lightweight periodic updates afterward.

## Test Checklist

1. Open dashboard with throttled network and observe first paint stability.
2. Verify pending badge appears without shifting row layout.
3. Verify card number area remains fixed while loading toggles.
4. Verify schedule section transition from skeleton to content does not push surrounding panels abruptly.
5. Verify interval updates (60s) refresh pending count without layout jitter.

---

## Department Head Dashboard CLS Scan

Date: 2026-04-20

### Scope
- Frontend/src/app/department-head/dashboard/page.tsx

### Findings (High to Medium Impact)

1. Stat-card value swap can cause micro-shifts in card content.
Locations:
- Frontend/src/app/department-head/dashboard/page.tsx#L112
- Frontend/src/app/department-head/dashboard/page.tsx#L100

Reason:
- The stat value area swaps a spinner with text/numbers and has no fixed value slot dimensions.

2. Workload panel has three distinct height states (spinner, list, empty text).
Locations:
- Frontend/src/app/department-head/dashboard/page.tsx#L134
- Frontend/src/app/department-head/dashboard/page.tsx#L158

Reason:
- Centered spinner block and short empty-state text are shorter than populated content, causing visible panel height jumps.

3. Recent activity panel has the same three-state height jump.
Locations:
- Frontend/src/app/department-head/dashboard/page.tsx#L169
- Frontend/src/app/department-head/dashboard/page.tsx#L172
- Frontend/src/app/department-head/dashboard/page.tsx#L184

Reason:
- The loading spinner and empty text do not reserve comparable space to the eventual activity list.

4. Conditional conflict alert insertion can shift content below when it appears/disappears.
Location:
- Frontend/src/app/department-head/dashboard/page.tsx#L122

Reason:
- Alert block is rendered only when conflict count is greater than zero, introducing/removing a full row.

5. Conditional schedule-status card insertion can shift sidebar stack.
Location:
- Frontend/src/app/department-head/dashboard/page.tsx#L232

Reason:
- Sidebar height and spacing reflow when the card mounts/unmounts based on data availability.

6. Frequent 15-second system period sync may retrigger filter state and loading transitions.
Locations:
- Frontend/src/app/department-head/dashboard/page.tsx#L60
- Frontend/src/app/department-head/dashboard/page.tsx#L52
- Frontend/src/app/department-head/dashboard/page.tsx#L53
- Frontend/src/app/department-head/dashboard/page.tsx#L69

Reason:
- Polling can repeatedly update academic year/semester state, causing repeated dashboard fetches and UI loading-state flips.

### Recommended Fixes

1. Reserve a fixed stat value slot.
Location:
- Frontend/src/app/department-head/dashboard/page.tsx#L112

Action:
- Add a stable min-height/min-width wrapper for value content so spinner-to-number replacement does not move neighboring text.

2. Use skeleton rows for workload and activity cards, sized to final row height.
Locations:
- Frontend/src/app/department-head/dashboard/page.tsx#L134
- Frontend/src/app/department-head/dashboard/page.tsx#L169

Action:
- Replace centered spinners with row-shaped placeholders and give each card a minimum content height.

3. Keep conflict alert slot stable.
Location:
- Frontend/src/app/department-head/dashboard/page.tsx#L122

Action:
- Render a reserved alert container with hidden/placeholder content when there are no conflicts.

4. Keep schedule-status panel slot stable.
Location:
- Frontend/src/app/department-head/dashboard/page.tsx#L232

Action:
- Render the card shell consistently and show placeholder/zero-state content when schedulesByStatus is missing.

5. Prevent unnecessary loading resets on filter sync.
Locations:
- Frontend/src/app/department-head/dashboard/page.tsx#L52
- Frontend/src/app/department-head/dashboard/page.tsx#L53

Action:
- Only call setSelectedAyId/setSelectedSemester when incoming values differ from current state.

6. Consider reducing sync frequency if strict 15-second updates are not required.
Location:
- Frontend/src/app/department-head/dashboard/page.tsx#L60

Action:
- Increase interval duration or make polling user-triggered in this dashboard view.

### Validation Checklist (Department Head)

1. Throttle network and confirm the page does not visibly jump when stats resolve.
2. Verify workload and activity cards keep near-constant height across loading, empty, and populated states.
3. Toggle conflicts between zero and non-zero and confirm downstream content does not noticeably jump.
4. Verify sidebar card positions stay stable regardless of schedule status data presence.
5. Confirm periodic system-period sync does not repeatedly flash loading indicators.
