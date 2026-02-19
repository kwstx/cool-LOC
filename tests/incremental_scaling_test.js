import CoreEngine from '../src/engine/CoreEngine.js';
import logger from '../src/logger/Logger.js';

async function runIncrementalTest() {
    console.log('\n=== STEP 12: INCREMENTAL TESTING AND SCALING ===\n');
    const engine = new CoreEngine();

    // --- PHASE 1: Single Agent, Few Tasks ---
    console.log('>>> PHASE 1: Single Agent Validation');
    const agent1Id = engine.registerAgent({
        id: 'agent-alpha',
        domainLabels: ['research', 'analysis'],
        skillScores: { research: 0.8, analysis: 0.7 },
        apiEndpoint: 'http://localhost:3001/task',
        performanceData: {}
    });

    const task1Id = engine.submitTask({
        description: 'Collect data on sustainable energy trends',
        domainLabel: 'research',
        complexityScore: 3,
        priority: 5
    });

    const task2Id = engine.submitTask({
        description: 'Initial market analysis for energy sector',
        domainLabel: 'analysis',
        complexityScore: 4,
        priority: 4
    });

    console.log('Processing Phase 1 tasks...');
    await engine.processQueue(); // Process task 1
    await engine.processQueue(); // Process task 2

    // Wait for async dispatch simulation
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Phase 1 Results:');
    console.log('Tasks Completed:', Object.keys(engine.taskOutputs).length);

    // --- PHASE 2: Gradual Scaling - Multiple Agents & Decomposition ---
    console.log('\n>>> PHASE 2: Gradual Scaling & Decomposition');
    const agent2Id = engine.registerAgent({
        id: 'agent-beta',
        domainLabels: ['analysis', 'logic'],
        skillScores: { analysis: 0.9, logic: 0.85 },
        apiEndpoint: 'http://localhost:3002/task',
        performanceData: {}
    });

    // Submit a complex task that might trigger decomposition if predicted success is low
    // Forcing low success by high complexity for current agents
    const complexTaskId = engine.submitTask({
        description: 'Comprehensive Strategy for Global AI Governance',
        domainLabel: 'logic',
        complexityScore: 10,
        priority: 8
    });

    console.log('Processing Phase 2 tasks...');
    // Lower threshold to trigger split more easily for testing if needed
    // engine.metaReflection.threshold = 0.8; 

    await engine.processQueue(); // This should trigger evaluation

    // Wait for subtasks to be created and processed
    await new Promise(resolve => setTimeout(resolve, 2000));
    await engine.processQueue(); // Process subtask 1
    await engine.processQueue(); // Process subtask 2

    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('Phase 2 Results:');
    console.log('Total Task Outputs:', Object.keys(engine.taskOutputs).length);
    const complexTask = engine.taskQueue.find(t => t.id === complexTaskId);
    console.log('Complex Task Status:', complexTask.status);
    if (complexTask.subtasks.length > 0) {
        console.log(`Decomposed into ${complexTask.subtasks.length} subtasks.`);
    }

    // --- PHASE 3: Cooperative Execution & Collaboration ---
    console.log('\n>>> PHASE 3: Cooperative Workflows');
    const agent3Id = engine.registerAgent({
        id: 'agent-gamma',
        domainLabels: ['optimization', 'data-science'],
        skillScores: { optimization: 0.9, 'data-science': 0.8 },
        apiEndpoint: 'http://localhost:3003/task',
        performanceData: { tasksCompleted: 0, successRate: 0, averageImpact: 0 }
    });

    const collaborativeTaskId = engine.submitTask({
        description: 'Cross-Domain Integration Project using Data Science',
        domainLabel: 'data-science',
        complexityScore: 6,
        priority: 9
    });

    // Manually trigger collaboration for testing if not triggered by meta-reflection
    const collaborativeTask = engine.taskQueue.find(t => t.id === collaborativeTaskId);
    engine.handleTaskCollaboration(collaborativeTask);

    console.log('Processing Phase 3 tasks...');
    await engine.processQueue();

    // Simulate agent Gamma using collaboration protocol
    await engine.collaborate(collaborativeTaskId, agent3Id, 'SHARE_RESULT', { partialData: 'Initial Integration Map' });
    await engine.collaborate(collaborativeTaskId, agent1Id, 'REQUEST_INPUT', { targetTaskId: collaborativeTaskId });

    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Phase 3 Results:');
    console.log('Collaboration Logs Count:', engine.collaborationLogs.length);
    console.log('Final Task Status:', engine.taskQueue.find(t => t.id === collaborativeTaskId).status);

    // --- MONITORING & SUMMARY ---
    console.log('\n=== FINAL MONITORING SUMMARY ===');
    const totalTasks = engine.taskQueue.length;
    const completedTasks = engine.taskQueue.filter(t => t.status === 'completed').length;
    const successRate = (completedTasks / totalTasks) * 100;

    console.log(`Total Tasks Managed: ${totalTasks}`);
    console.log(`Successfully Completed: ${completedTasks}`);
    console.log(`Overall Success Rate: ${successRate.toFixed(2)}%`);

    console.log('\nAgent Performance:');
    Object.entries(engine.agents).forEach(([id, agent]) => {
        console.log(`- ${id}: Success Rate: ${(agent.performanceData.successRate * 100).toFixed(2)}%, Tasks: ${agent.performanceData.tasksCompleted}, Avg Impact: ${agent.performanceData.averageImpact.toFixed(2)}`);
    });

    console.log('\nTest completed successfully.');
}

runIncrementalTest().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
