import CoreEngine from '../src/engine/CoreEngine.js';
import logger from '../src/logger/Logger.js';

async function runLoggingTest() {
    const engine = new CoreEngine();

    // Mock dispatch to provide deterministic results
    engine.dispatchToAgent = async (agent, task) => {
        return {
            resultData: `Aggregated data for ${task.description}`,
            confidenceScore: 0.85,
            actualImpact: 8.5,
            executionTime: 120
        };
    };

    console.log('\n--- Setup: Registering Agents and Submitting Tasks ---');
    engine.registerAgent({
        id: 'agent-alpha',
        domainLabels: ['data-science'],
        skillScores: { 'data-science': 8 },
        apiEndpoint: 'http://alpha',
        performanceData: {}
    });

    const task1 = {
        description: 'Analyze dataset X',
        domainLabel: 'data-science',
        complexityScore: 7,
        priority: 6
    };

    const task2 = {
        description: 'Clean dataset Y',
        domainLabel: 'data-science',
        complexityScore: 4,
        priority: 4
    };

    const id1 = engine.submitTask(task1);
    const id2 = engine.submitTask(task2);

    console.log('\n--- Step 1: Executing Tasks ---');
    await engine.processQueue(); // Processes Task 1
    await engine.processQueue(); // Processes Task 2

    console.log('\n--- Step 2: Real-time Querying ---');
    const allLogs = logger.query();
    console.log(`Total execution logs recorded: ${allLogs.length}`);

    const alphaLogs = logger.query({ agentId: 'agent-alpha' });
    console.log(`Logs for agent-alpha: ${alphaLogs.length}`);

    if (alphaLogs.length === 2) {
        console.log('PASSED: Querying by agentId works.');
    } else {
        console.log('FAILED: Querying by agentId failed.');
    }

    const dsLogs = logger.query({ domain: 'data-science' });
    console.log(`Logs for data-science domain: ${dsLogs.length}`);
    if (dsLogs.length === 2) {
        console.log('PASSED: Querying by domain works.');
    }

    console.log('\n--- Step 3: Aggregation ---');
    const agentImpact = logger.aggregate('agentId', 'actualImpact', 'sum');
    console.log('Total Impact by Agent:', JSON.stringify(agentImpact));
    if (agentImpact['agent-alpha'] === 17) {
        console.log('PASSED: Aggregation (sum) works.');
    }

    const domainAvgImpact = logger.aggregate('domain', 'actualImpact', 'avg');
    console.log('Average Impact by Domain:', JSON.stringify(domainAvgImpact));
    if (domainAvgImpact['data-science'] === 8.5) {
        console.log('PASSED: Aggregation (avg) works.');
    }

    console.log('\n--- Step 4: Exporting ---');
    const exported = logger.export();
    const parsedExport = JSON.parse(exported);
    if (Array.isArray(parsedExport) && parsedExport.length === allLogs.length) {
        console.log('PASSED: Export format is valid JSON.');
    }

    console.log('\n--- Step 5: Collaboration Dependencies ---');
    // Test a subtask/decomposition to verify dependency logging
    const complexTask = {
        description: 'Complex decomposition task',
        domainLabel: 'data-science',
        complexityScore: 9,
        priority: 10
    };
    const parentId = engine.submitTask(complexTask);
    const subtaskIds = engine.decomposeTask(parentId, [
        { description: 'Phase 1', domainLabel: 'data-science', complexityScore: 5 },
        { description: 'Phase 2', domainLabel: 'data-science', complexityScore: 5, dependencies: [] }
    ]);

    // Process subtasks
    await engine.processQueue();
    await engine.processQueue();

    const parentLog = logger.query({ taskId: parentId, agentId: 'AGGREGATOR_SYSTEM' });
    if (parentLog.length > 0) {
        console.log('PASSED: Aggregated parent task logged correctly.');
        console.log('Parent Log Collaboration Info:', JSON.stringify(parentLog[0].collaboration));
        console.log('Parent Log Dependencies:', JSON.stringify(parentLog[0].dependencies));
    }

    process.exit(0);
}

runLoggingTest().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
