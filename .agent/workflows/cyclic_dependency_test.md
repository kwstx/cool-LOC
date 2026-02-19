---
description: Evaluate LOC orchestration under deep, cyclic dependencies and cascading failures.
---
This workflow tests the system's ability to detect deadlocks, handle incorrect agent outputs, and prevent failure cascades.

### Execution Steps
1. Register specialized agents for 'analysis', 'logic', and 'creative-writing'.
2. Submit a cyclic dependency chain: Task A -> Task B -> Task C -> Task A.
3. Submit a high-priority task with multiple dependencies on the cyclic chain.
4. Mock agent execution to return variable confidence scores (simulating incorrect outputs).
5. Run the CoreEngine execution loop and monitor task states.

### Success Criteria
- The engine must detect the cyclic dependency loop and fail the involved tasks (Task A, B, C).
- The engine must prevent a stall by failing the dependent task (Task D) once its dependencies have failed.
- The engine must log the reason for failure as 'CYCLIC_DEPENDENCY_FAILURE' and 'DEPENDENCY_FAILURE_CASCADE'.
- The engine should remain responsive and process other non-stalled tasks if they exist.

// turbo
6. Run the evaluation script:
```powershell
node tests/complex_dependency_workflow.js
```
