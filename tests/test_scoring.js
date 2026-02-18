import CoreEngine from '../src/engine/CoreEngine.js';
import logger from '../src/logger/Logger.js';

async function testScoringAndReassignment() {
    const engine = new CoreEngine();

    // 1. Register Agents with different skills
    engine.registerAgent({
        id: 'expert-researcher',
        domainLabels: ['research'],
        skillScores: { research: 10 },
        apiEndpoint: 'http://expert-research/task',
        performanceData: { successRate: 0.95, tasksCompleted: 100 }
    });

    engine.registerAgent({
        id: 'junior-researcher',
        domainLabels: ['research'],
        skillScores: { research: 4 },
        apiEndpoint: 'http://junior-research/task',
        performanceData: { successRate: 0.7, tasksCompleted: 10 }
    });

    engine.registerAgent({
        id: 'analyst',
        domainLabels: ['analysis'],
        skillScores: { analysis: 9 },
        apiEndpoint: 'http://analyst/task',
        performanceData: { successRate: 0.9, tasksCompleted: 50 }
    });

    console.log('\n--- Testing Scenarios ---');

    // Scenario 1: Expert Selection
    console.log('\nSCENARIO 1: Selecting best agent for complex research task');
    const task1 = {
        description: 'Deep market analysis',
        domainLabel: 'research',
        complexityScore: 8,
        priority: 10
    };
    const bestAgent1 = engine.findBestAgentForTask(task1);
    console.log(`Task 1 Domain: ${task1.domainLabel}, Complexity: ${task1.complexityScore}`);
    console.log(`Best Agent Selected: ${bestAgent1} (Expected: expert-researcher)`);

    // Scenario 2: Scoring validation
    console.log('\nSCENARIO 2: Compatibility scores');
    for (const agentId in engine.agents) {
        const score = engine.calculateCompatibility(engine.agents[agentId], task1);
        logger.info('SCORING_CHECK', `Agent: ${agentId}, Score: ${score}`, { agentId, score, taskDomain: task1.domainLabel });
        console.log(`Agent: ${agentId}, Score: ${score}`);
    }

    // Scenario 3: Execution and reassignment loop
    console.log('\nSCENARIO 3: Dynamic reassignment if confidence is low');

    // We'll mock dispatchToAgent briefly to force a low confidence score
    const originalDispatch = engine.dispatchToAgent;
    let callCount = 0;
    engine.dispatchToAgent = async (agent, task) => {
        callCount++;
        if (callCount === 1) {
            console.log(`[Mock] Injecting low confidence for first attempt by ${agent.id}`);
            return {
                resultData: 'Initial attempt result',
                confidenceScore: 0.4, // Below threshold
                predictedImpact: 5,
                executionTime: 100
            };
        }
        console.log(`[Mock] Injecting high confidence for second attempt by ${agent.id}`);
        return {
            resultData: 'Second attempt successful',
            confidenceScore: 0.9,
            predictedImpact: 8,
            executionTime: 150
        };
    };

    const taskId = engine.submitTask({
        description: 'Critical analysis task',
        domainLabel: 'analysis',
        complexityScore: 5,
        priority: 8
    });

    console.log('Processing queue...');
    await engine.processQueue(); // First attempt - should fail confidence and reassign

    const taskAfterFirst = engine.taskQueue.find(t => t.id === taskId);
    console.log(`Task Status after first process: ${taskAfterFirst.status}, Retry Count: ${taskAfterFirst.retryCount}`);

    console.log('Processing queue again...');
    await engine.processQueue(); // Second attempt - should succeed

    const taskAfterSecond = engine.taskQueue.find(t => t.id === taskId);
    console.log(`Task Status after second process: ${taskAfterSecond.status}`);
    console.log(`Task Output:`, engine.taskOutputs[taskId]?.resultData);

    // Restore original dispatch
    engine.dispatchToAgent = originalDispatch;
}

testScoringAndReassignment().catch(console.error);
