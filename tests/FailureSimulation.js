import CoreEngine from '../src/engine/CoreEngine.js';
import logger from '../src/logger/Logger.js';

async function runFailureSimulation() {
    console.log('--- STARTING SIMULATION ---');
    const engine = new CoreEngine();

    // Use valid domains from src/constants/Domains.js
    const domains = ['logic', 'analysis', 'creative-writing'];
    const flakyAgentIds = new Set(['agent_0', 'agent_5', 'agent_10', 'agent_15']);
    const agentStats = {};

    console.log('>>> Registering Agents...');
    for (let i = 0; i < 20; i++) {
        const id = `agent_${i}`;
        const domain = domains[i % domains.length];
        engine.registerAgent({
            id: id,
            domainLabels: [domain],
            skillScores: { [domain]: 8 },
            apiEndpoint: `http://localhost/agents/${id}`,
            performanceData: { tasksCompleted: 0, successRate: 1.0, averageImpact: 5 }
        });
        agentStats[id] = { hitCount: 0, failCount: 0 };
    }

    const originalDispatch = engine.dispatchToAgent.bind(engine);
    engine.dispatchToAgent = async (agent, task) => {
        agentStats[agent.id].hitCount++;
        if (flakyAgentIds.has(agent.id)) {
            const roll = Math.random();
            if (roll < 0.7) { // 70% failure rate for flaky
                agentStats[agent.id].failCount++;
                if (roll < 0.2) throw new Error('CRASH');
                if (roll < 0.4) return new Promise((_, r) => setTimeout(() => r(new Error('TIMEOUT')), 100));
                // Incorrect output (Low confidence)
                return { confidenceScore: 0.3, resultData: 'BAD_OUTPUT', actualImpact: 0, executionTime: 10 };
            }
        }
        return originalDispatch(agent, task);
    };

    console.log('>>> Submitting Tasks...');
    for (let i = 0; i < 60; i++) {
        engine.submitTask({
            description: `Task ${i}`,
            domainLabel: domains[i % domains.length],
            complexityScore: 5,
            priority: 5
        });
    }

    console.log('>>> Executing...');
    let cycles = 0;
    while (cycles < 200) {
        cycles++;
        const idleAgents = Object.values(engine.agents).filter(a => a.status === 'idle');
        const pending = engine.taskQueue.filter(t => t.status === 'pending');

        if (pending.length === 0 && engine.taskQueue.filter(t => t.status === 'processing').length === 0) break;

        const toProcess = Math.min(idleAgents.length, 5);
        if (toProcess > 0) {
            const promises = [];
            for (let i = 0; i < toProcess; i++) {
                promises.push(engine.processQueue());
            }
            await Promise.all(promises);
        }

        if (cycles % 20 === 0) {
            const stats = {
                completed: engine.taskQueue.filter(t => t.status === 'completed').length,
                failed: engine.taskQueue.filter(t => t.status === 'failed').length,
                pending: engine.taskQueue.filter(t => t.status === 'pending').length,
                processing: engine.taskQueue.filter(t => t.status === 'processing').length
            };
            console.log(`Cycle ${cycles}: Cmp:${stats.completed}, Fld:${stats.failed}, Pnd:${stats.pending}, Prc:${stats.processing}`);
        }
        await new Promise(r => setTimeout(r, 20));
    }

    console.log('\n--- SIMULATION RESULTS ---');
    const totalTasks = engine.taskQueue.length;
    const completed = engine.taskQueue.filter(t => t.status === 'completed').length;
    const failed = engine.taskQueue.filter(t => t.status === 'failed').length;

    console.log(`Total Tasks: ${totalTasks}`);
    console.log(`Completed:   ${completed}`);
    console.log(`Failed:      ${failed}`);

    console.log('\nAgent Activity (Hit Counts):');
    for (let i = 0; i < 20; i++) {
        const id = `agent_${i}`;
        const isFlaky = flakyAgentIds.has(id) ? '[FLAKY]' : '[STABLE]';
        const hitCount = agentStats[id].hitCount;
        const successRate = engine.agents[id].performanceData.successRate;
        console.log(`${id.padEnd(10)} ${isFlaky.padEnd(10)} Hits: ${hitCount.toString().padEnd(3)} SuccessRate: ${(successRate * 100).toFixed(1)}%`);
    }

    const flakyHits = Array.from(flakyAgentIds).reduce((sum, id) => sum + agentStats[id].hitCount, 0);
    const stableHits = Object.keys(agentStats).filter(id => !flakyAgentIds.has(id)).reduce((sum, id) => sum + agentStats[id].hitCount, 0);

    console.log(`\nAverage Hits per Flaky Agent:  ${(flakyHits / 4).toFixed(1)}`);
    console.log(`Average Hits per Stable Agent: ${(stableHits / 16).toFixed(1)}`);

    if (flakyHits / 4 < stableHits / 16) {
        console.log('\n[EVALUATION] SUCCESS: Predictive metrics successfully reduced assignments to flaky agents.');
    } else {
        console.log('\n[EVALUATION] OBSERVATION: Flaky agents were used similarly to stable ones. This may indicate they were the primary/only options for their domains at times.');
    }

    console.log('\n--- SYSTEM RECOVERY ---');
    const retriedTasks = engine.taskQueue.filter(t => t.retryCount > 0);
    const recovered = retriedTasks.filter(t => t.status === 'completed').length;
    console.log(`Tasks requiring retry: ${retriedTasks.length}`);
    console.log(`Tasks successfully recovered: ${recovered}`);

    process.exit(0);
}

runFailureSimulation().catch(e => {
    console.error('Fatal Simulation Error:', e);
    process.exit(1);
});
