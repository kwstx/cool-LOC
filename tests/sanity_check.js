import CoreEngine from '../src/engine/CoreEngine.js';

const engine = new CoreEngine();

// 1. Register Agents
const researchAgentId = engine.registerAgent({
    id: 'researcher-01',
    domainLabels: ['research', 'data-collection'],
    skillScores: { research: 0.9, data: 0.8 },
    apiEndpoint: 'http://localhost:3001/task'
});

const logicAgentId = engine.registerAgent({
    id: 'logic-01',
    domainLabels: ['analysis', 'logic'],
    skillScores: { analysis: 0.95 },
    apiEndpoint: 'http://localhost:3002/task'
});

// 2. Submit Tasks
const taskId = engine.submitTask({
    requirements: { domains: ['research'] },
    payload: { query: 'Analyze market trends for AI agents' },
    priority: 5
});

// 3. Assign Tasks
engine.assignTasks();

// 4. Log Output
engine.logOutput(taskId, {
    success: true,
    data: { trends: ['growth', 'modularity', 'autonomy'] }
});

console.log('\n--- Engine State Summary ---');
console.log('Agents:', JSON.stringify(engine.agents, null, 2));
console.log('Task Queue Length:', engine.taskQueue.length);
console.log('Task Outputs:', JSON.stringify(engine.taskOutputs, null, 2));
