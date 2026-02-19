import CoreEngine from '../src/engine/CoreEngine.js';

const engine = new CoreEngine();

// 1. Register Agents
const researchAgentId = engine.registerAgent({
    id: 'researcher-01',
    domainLabels: ['research', 'data-collection'],
    skillScores: { research: 0.9, data: 0.8 },
    apiEndpoint: 'http://localhost:3001/task',
    performanceData: { successRate: 0.9, tasksCompleted: 50 }
});

const logicAgentId = engine.registerAgent({
    id: 'logic-01',
    domainLabels: ['analysis', 'logic'],
    skillScores: { analysis: 0.95 },
    apiEndpoint: 'http://localhost:3002/task',
    performanceData: { successRate: 0.95, tasksCompleted: 120 }
});

// 2. Submit Tasks
const taskId = engine.submitTask({
    description: 'Analyze market trends for AI agents',
    domainLabel: 'research',
    complexityScore: 4,
    priority: 5
});

// 3. Assign Tasks
engine.assignTasks();

// 4. Log Output
engine.logOutput(taskId, researchAgentId, {
    resultData: { trends: ['growth', 'modularity', 'autonomy'] },
    confidenceScore: 0.9,
    actualImpact: 5,
    executionTime: 200
});

console.log('\n--- Engine State Summary ---');
console.log('Agents:', JSON.stringify(engine.agents, null, 2));
console.log('Task Queue Length:', engine.taskQueue.length);
console.log('Task Outputs:', JSON.stringify(engine.taskOutputs, null, 2));
