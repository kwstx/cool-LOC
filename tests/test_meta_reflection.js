import CoreEngine from '../src/engine/CoreEngine.js';

async function runTestSuite() {
    const engine = new CoreEngine();

    // Mock dispatch to avoid random failures and delays
    engine.dispatchToAgent = async (agent, task) => {
        return {
            resultData: `Executed: ${task.description}`,
            confidenceScore: 0.9,
            predictedImpact: 7,
            executionTime: 50
        };
    };

    console.log('\n--- Scenario 1: SPLIT Strategy ---');
    engine.registerAgent({
        id: 'junior-1',
        domainLabels: ['coding'],
        skillScores: { coding: 3 },
        apiEndpoint: 'http://junior1',
        performanceData: {}
    });

    const taskSplit = {
        description: 'Very complex task',
        domainLabel: 'coding',
        complexityScore: 9,
        priority: 10
    };

    const taskId1 = engine.submitTask(taskSplit);
    await engine.processQueue(); // Handles the split
    const t1 = engine.taskQueue.find(t => t.id === taskId1);
    console.log(`Task 1 Status: ${t1.status}, Subtasks: ${t1.subtasks.length}`);
    if (t1.status === 'waiting_for_subtasks' && t1.subtasks.length === 2) {
        console.log('PASSED: Task correctly split.');
    }

    // Clear queue for next scenario
    engine.taskQueue = [];

    console.log('\n--- Scenario 2: COLLABORATE Strategy ---');
    engine.registerAgent({
        id: 'junior-2',
        domainLabels: ['coding'],
        skillScores: { coding: 3 },
        apiEndpoint: 'http://junior2',
        performanceData: {}
    });

    const taskCollab = {
        description: 'Moderate but tricky task',
        domainLabel: 'coding',
        complexityScore: 5,
        priority: 5
    };

    const taskId2 = engine.submitTask(taskCollab);
    await engine.processQueue();
    const t2 = engine.taskQueue.find(t => t.id === taskId2);

    console.log(`Task 2 Assigned To: ${t2.assignedTo}`);
    console.log(`Task 2 Is Collaborative: ${t2.isCollaborative}, Suggested Action: ${t2.suggestedAction}`);
    if (t2.isCollaborative && t2.suggestedAction === 'USE_COLLABORATION_PROTOCOL') {
        console.log('PASSED: Collaboration suggested.');
    }

    console.log('\n--- Scenario 3: Metadata Updates ---');
    const assignedAgentId = t2.assignedTo;
    if (assignedAgentId) {
        const assignedAgent = engine.agents[assignedAgentId];
        console.log(`Task 2 was executed by: ${assignedAgentId}`);
        console.log('Domain Metadata (coding):', JSON.stringify(assignedAgent.performanceData.domains.coding));

        if (assignedAgent.performanceData.domains.coding.tasksCompleted > 0) {
            console.log('PASSED: Domain metadata updated.');
        }
    } else {
        console.log('FAILED: Task 2 was not assigned.');
    }

    process.exit(0);
}

runTestSuite().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
