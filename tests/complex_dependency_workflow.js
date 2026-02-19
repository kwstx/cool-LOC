import CoreEngine from '../src/engine/CoreEngine.js';
import logger from '../src/logger/Logger.js';

async function runComplexWorkflow() {
    const engine = new CoreEngine();

    // Register specialized agents
    engine.registerAgent({
        id: 'agent-alpha',
        domainLabels: ['analysis', 'logic'],
        skillScores: { 'analysis': 9, 'logic': 8 },
        apiEndpoint: 'http://alpha',
        performanceData: {}
    });

    engine.registerAgent({
        id: 'agent-beta',
        domainLabels: ['creative-writing', 'logic'],
        skillScores: { 'creative-writing': 8, 'logic': 7 },
        apiEndpoint: 'http://beta',
        performanceData: {}
    });

    engine.registerAgent({
        id: 'agent-gamma',
        domainLabels: ['logic', 'analysis'],
        skillScores: { 'logic': 9, 'analysis': 7 },
        apiEndpoint: 'http://gamma',
        performanceData: {}
    });

    // Mock dispatch to simulate slightly incorrect outputs and random delays
    engine.dispatchToAgent = async (agent, task) => {
        const errorProbability = 0.2;
        const isIncorrect = Math.random() < errorProbability;

        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    resultData: `Output for "${task.description}" ${isIncorrect ? '(contains slight errors)' : ''}`,
                    confidenceScore: isIncorrect ? 0.45 : 0.85,
                    actualImpact: isIncorrect ? 3 : 8,
                    executionTime: 100 + Math.random() * 200
                });
            }, 100);
        });
    };

    console.log('\n=== Submitting Tasks with Deep, Cyclic Dependencies ===');

    const id1 = 'task_cycle_1';
    const id2 = 'task_cycle_2';
    const id3 = 'task_cycle_3';

    engine.taskQueue.push({
        id: id1,
        taskID: id1,
        description: 'Circular Task A',
        domainLabel: 'logic',
        priority: 5,
        complexityScore: 6,
        status: 'pending',
        dependencies: [id2],
        timestamp: new Date().toISOString(),
        retryCount: 0,
        failedAgents: []
    });

    engine.taskQueue.push({
        id: id2,
        taskID: id2,
        description: 'Circular Task B',
        domainLabel: 'analysis',
        priority: 5,
        complexityScore: 4,
        status: 'pending',
        dependencies: [id3],
        timestamp: new Date().toISOString(),
        retryCount: 0,
        failedAgents: []
    });

    engine.taskQueue.push({
        id: id3,
        taskID: id3,
        description: 'Circular Task C',
        domainLabel: 'logic',
        priority: 5,
        complexityScore: 5,
        status: 'pending',
        dependencies: [id1],
        timestamp: new Date().toISOString(),
        retryCount: 0,
        failedAgents: []
    });

    console.log(`Submitted 3 tasks forming a cycle: ${id1} -> ${id2} -> ${id3} -> ${id1}`);

    // Submit a task depending on multiple other agents
    const multiDepId = 'task_multi_dep';
    engine.submitTask({
        description: 'Task depending on Alpha and Beta outputs',
        domainLabel: 'creative-writing',
        priority: 8,
        complexityScore: 7,
        dependencies: [id1, id2]
    });

    // Run the engine for a bit and monitor
    console.log('\n=== Starting Engine Execution Loop ===');
    engine.startExecutionLoop(500);

    let iterations = 0;
    const maxIterations = 15;
    const monitorInterval = setInterval(() => {
        iterations++;
        const pending = engine.taskQueue.filter(t => t.status === 'pending');
        const processing = engine.taskQueue.filter(t => t.status === 'processing');
        const completed = engine.taskQueue.filter(t => t.status === 'completed');
        const failed = engine.taskQueue.filter(t => t.status === 'failed');

        console.log(`\nIteration ${iterations}:`);
        console.log(`- Pending: ${pending.length}`);
        console.log(`- Processing: ${processing.length}`);
        console.log(`- Completed: ${completed.length}`);
        console.log(`- Failed: ${failed.length}`);

        if (pending.length > 0) {
            console.log('  Stuck tasks:', pending.map(t => `${t.id} (deps: ${t.dependencies.join(',')})`).join(', '));
        }

        if (iterations >= maxIterations) {
            clearInterval(monitorInterval);
            engine.stopExecutionLoop();
            console.log('\n=== Simulation Finished ===');

            // Evaluation
            const isStalled = pending.length > 0 && processing.length === 0;
            if (isStalled) {
                console.log('\nEVALUATION: The core is STALLED. It cannot detect the cyclic dependency loop.');
            } else {
                console.log('\nEVALUATION: The core successfully DETECTED and HANDLED the cyclic dependencies.');
                console.log('All stuck tasks were failed by the Cycle Detector or Dependency Manager.');
            }

            process.exit(0);
        }
    }, 1000);
}

runComplexWorkflow().catch(err => {
    console.error('Workflow failed:', err);
    process.exit(1);
});
