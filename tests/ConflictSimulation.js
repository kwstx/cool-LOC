import CoreEngine from '../src/engine/CoreEngine.js';
import logger from '../src/logger/Logger.js';

async function runConflictSimulation() {
    logger.info('SIMULATION_START', 'Starting High-Priority Conflict and Race Condition Simulation');

    const engine = new CoreEngine();

    // 1. Register Agents with overlapping domains
    const agentA = engine.registerAgent({
        id: 'Agent_Alpha',
        domainLabels: ['data-collection', 'analysis'],
        skillScores: { 'data-collection': 9, analysis: 8 },
        apiEndpoint: 'http://agent-alpha/api',
        performanceData: { successRate: 0.9, tasksCompleted: 50 }
    });

    const agentB = engine.registerAgent({
        id: 'Agent_Beta',
        domainLabels: ['data-collection', 'logic'],
        skillScores: { 'data-collection': 8, logic: 9 },
        apiEndpoint: 'http://agent-beta/api',
        performanceData: { successRate: 0.85, tasksCompleted: 40 }
    });

    // 2. Submit high-priority tasks that interfere with each other
    const task1Id = engine.submitTask({
        description: 'High-Priority Data Scraping',
        domainLabel: 'data-collection',
        complexityScore: 8,
        priority: 10,
        interferedBy: ['logic'] // Simulated interference from logic tasks
    });

    const task2Id = engine.submitTask({
        description: 'Large Dataset Analysis',
        domainLabel: 'analysis',
        complexityScore: 7,
        priority: 9,
        interferedBy: ['data-collection'] // Interference from data collection
    });

    const task3Id = engine.submitTask({
        description: 'Complex Pattern Logic',
        domainLabel: 'logic',
        complexityScore: 6,
        priority: 9,
        interferedBy: []
    });

    logger.info('TASKS_SUBMITTED', 'Conflicts prepared: Task 2 is interfered by data-collection tasks.');

    // 3. Simulate Race Condition: Both agents try to claim Task 1 at the "same" time
    logger.info('RACE_CONDITION_INIT', `Simulating Agent_Alpha and Agent_Beta racing for Task ${task1Id}`);

    const results = await Promise.all([
        engine.agentClaimTask('Agent_Alpha', task1Id),
        engine.agentClaimTask('Agent_Beta', task1Id)
    ]);

    logger.info('RACE_CONDITION_RESULTS', 'Race finished', {
        agentAlphaClaim: results[0] ? 'SUCCESS' : 'FAILED',
        agentBetaClaim: results[1] ? 'SUCCESS' : 'FAILED'
    });

    // 4. Observe Interference: Execute a logic task, then see if Task 2 is affected
    logger.info('INTERFERENCE_OBSERVATION_INIT', 'Starting Complex Pattern Logic to interfere with subsequent tasks');

    await engine.agentClaimTask('Agent_Beta', task3Id); // Agent Beta handles logic task

    logger.info('INTERFERENCE_CHECK', 'Attempting Task 2 claim after interfering tasks (data-collection and logic) are handled');

    // Agent Alpha attempts Task 2. Task 2 is interfered by 'data-collection' (Task 1)
    await engine.agentClaimTask('Agent_Alpha', task2Id);

    // 5. Final Report
    setTimeout(() => {
        logger.info('SIMULATION_SUMMARY', 'Simulation Complete. Reviewing final states...');
        console.log('\n--- TASK STATES ---');
        engine.taskQueue.forEach(t => {
            console.log(`[Task ${t.id}] ${t.description} | Status: ${t.status} | Assigned: ${t.assignedTo}`);
        });

        console.log('\n--- AGENT STATES ---');
        Object.values(engine.agents).forEach(a => {
            console.log(`[Agent ${a.id}] Status: ${a.status} | Domains: ${JSON.stringify(a.performanceData.domains || {})}`);
        });

        engine.stopExecutionLoop();
    }, 2000);
}

runConflictSimulation().catch(err => {
    logger.error('SIMULATION_CRASHED', 'Simulation failed due to error', err);
});
