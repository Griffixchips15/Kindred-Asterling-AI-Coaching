# Phase 2D remaining acceptance

Baseline: `f7ddedc8015f00bb0446f7bc734329d894181117`, merged in GitLab MR !118.
The owner has confirmed successful local daily-flow/visual review and native
200% browser zoom. The automated journey, keyboard/reflow checks, and CI results
are recorded in [the quality report](phase-2d-quality.md).

## Screen-reader session

Use a test account on a running preview of the combined Auth0/Phase 2D version.
Record the browser, screen reader, version, and tested commit. Use synthetic
wellness entries. A DOM or accessibility-tree inspection does not replace this
human session.

1. Sign in through Auth0 and confirm the requested signed-in destination opens.
2. Find the main landmark and page heading. Activate the skip link and confirm
   that navigation does not have to be repeated to reach the page content.
3. Open Morning from Today. Confirm all fields have meaningful names and that
   required-field errors can be found and understood. Save a test check-in.
4. Return to Today and confirm the next action reflects the saved check-in.
5. Open a body scan. Confirm energy is announced with its value and can be changed
   by keyboard; save the scan. Complete one prepared test habit.
6. Open Evening. Confirm the mood radio group announces its name, current choice,
   and choices reached by arrow keys. Save the review and check Today again.
7. At a mobile layout, open More, navigate to a page, and confirm focus reaches
   its content. Reopen More and press Escape; focus should return to More.
8. Open and close a dialog. Confirm its title, fields, close control, focus
   containment, and return to the opening control are understandable.

Record a pass only when the tester can complete the actions and understand the
saved outcome. For a failure, record the route, control, action, expected result,
and observed announcement/focus behavior. Do not include passwords, tokens, or
personal health details in notes.

## Five-user pilot

Use five representative testers, identified as P1–P5 in results. Give each a test
account with a habit prepared. Include the medication step only for a test
account with a synthetic schedule. Do not ask anyone to change actual medication
use as part of the exercise.

Give this task without explaining which navigation controls to choose:

> Start on Today. Plan your morning, record how you feel, complete your prepared
> habit, and review your evening. Return to Today after each step and use its
> recommended action. Tell us when you believe your day is complete.

Record whether each tester completes the loop without assistance or needing the
full navigation. Record where they hesitate, lose their place, or see a stale
next step. Do not fill results before a session happens.

| Tester | Commit / browser | Morning → evening completed | Assistance or full navigation needed | Issue references |
| --- | --- | --- | --- | --- |
| P1 | Pending | Pending | Pending | Pending |
| P2 | Pending | Pending | Pending | Pending |
| P3 | Pending | Pending | Pending | Pending |
| P4 | Pending | Pending | Pending | Pending |
| P5 | Pending | Pending | Pending | Pending |

Phase 2D's human acceptance gate is met after the screen-reader session passes
and all five users complete the daily flow without assistance or the full
navigation. Repair observed blockers and repeat the affected steps before
recording acceptance. This record does not authorize deployment or provider/data
cleanup.
