import CoreEngine from '../src/engine/CoreEngine.js';
import logger from '../src/logger/Logger.js';

async function runResourceSimulation() {
    logger.info('SIMULATION_START', 'Starting Shared Resource Competition Simulation');

    const engine = new CoreEngine();

    // 1. Register Resources
    engine.registerResource('PRIMARY_API', 'exclusive');
    engine.registerResource('COMPUTE_CLUSTER', 'parallel', 2); // Can handle 2 tasks at once

    // 2. Register Agents (Identical skills to test load balancing)
    const agentSpecs = [
        { id: 'Agent_A', rate: 0.9, tasks: 50 },
        { id: 'Agent_B', rate: 0.9, tasks: 50 },
        { id: 'Agent_C', rate: 0.9, tasks: 50 }
    ];

    agentSpecs.forEach(spec => {
        engine.registerAgent({
            id: spec.id,
            domainLabels: ['data-collection'],
            skillScores: { 'data-collection': 8 },
            apiEndpoint: `http://${spec.id.toLowerCase()}/api`,
            performanceData: { successRate: spec.rate, tasksCompleted: spec.tasks }
        });
    });

    // 3. Submit Tasks with resource conflicts

    // API-heavy tasks (Exclusive)
    for (let i = 1; i <= 4; i++) {
        engine.submitTask({
            description: `API Task ${i}`,
            domainLabel: 'data-collection',
            complexityScore: 5,
            priority: 5,
            resourceRequirements: { 'PRIMARY_API': 'exclusive' }
        });
    }

    // Compute-heavy tasks (Parallel, capacity 2)
    for (let i = 1; i <= 6; i++) {
        engine.submitTask({
            description: `Compute Task ${i}`,
            domainLabel: 'data-collection',
            complexityScore: 5,
            priority: 5,
            resourceRequirements: { 'COMPUTE_CLUSTER': 'parallel' }
        });
    }

    logger.info('TASKS_SUBMITTED', '10 tasks submitted with varying resource constraints.');

    // 4. Start execution loop (Faster interval to catch idle agents)
    engine.startExecutionLoop(100);

    // 5. Monitor and Report
    const monitorInterval = setInterval(() => {
        const activeTasks = engine.taskQueue.filter(t => t.status === 'processing');
        const pendingTasks = engine.taskQueue.filter(t => t.status === 'pending');
        const completedTasks = engine.taskQueue.filter(t => t.status === 'completed');

        console.log(`\n--- Status Update (${completedTasks.length}/10) ---`);
        console.log(`Active Tasks: ${activeTasks.length}`);
        activeTasks.forEach(t => console.log(` - [${t.id}] ${t.description} (Agent: ${t.assignedTo})`));
        console.log(`Pending Tasks: ${pendingTasks.length}`);
        pendingTasks.forEach(t => console.log(` - [${t.id}] ${t.description}`));

        console.log(`Resource Usage:`);
        Object.values(engine.resources).forEach(r => {
            console.log(` - ${r.id}: ${r.currentUsage}/${r.capacity} (Locked by: ${r.lockedBy || 'None'})`);
        });

        if (activeTasks.length === 0 && pendingTasks.length === 0) {
            clearInterval(monitorInterval);
            finishSimulation();
        }
    }, 1000);

    function finishSimulation() {
        setTimeout(() => {
            logger.info('SIMULATION_DONE', 'All tasks processed. Final states check:');
            engine.taskQueue.forEach(t => {
                const output = engine.taskOutputs[t.id];
                console.log(`Task ${t.id} completed with status: ${t.status}`);
            });
            engine.stopExecutionLoop();
            process.exit(0);
        }, 1000);
    }
}

runResourceSimulation().catch(err => {
    logger.error('SIMULATION_CRASHED', 'Simulation failed', err);
    process.exit(1);
});
