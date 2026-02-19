import CoreEngine from '../src/engine/CoreEngine.js';
import logger from '../src/logger/Logger.js';
import { VALID_DOMAINS } from '../src/constants/Domains.js';

async function runEdgeCaseSimulation() {
    console.log('--- STARTING EDGE CASE SIMULATION ---');
    const engine = new CoreEngine();

    // Register some valid agents for baseline
    console.log('>>> Registering Base Agents...');
    ['logic', 'analysis', 'coding'].forEach((domain, i) => {
        engine.registerAgent({
            id: `base_agent_${i}`,
            domainLabels: [domain],
            skillScores: { [domain]: 9 },
            apiEndpoint: `http://localhost/agents/base_${i}`,
            performanceData: { tasksCompleted: 0, successRate: 1.0, averageImpact: 5 }
        });
    });

    // -------------------------------------------------------------------------
    // PHASE 1: Malformed Task Submission (Expected to fail validation)
    // -------------------------------------------------------------------------
    console.log('\n--- PHASE 1: MALFORMED TASK SUBMISSION ---');
    const malformedTasks = [
        {}, // Empty task
        { description: 'Missing domain' },
        { domainLabel: 'logic', complexityScore: 5 }, // Missing description
        { description: 'Invalid complexity', domainLabel: 'logic', complexityScore: 100 },
        { description: 'Invalid domain', domainLabel: 'black-magic', complexityScore: 5 }
    ];

    malformedTasks.forEach((t, i) => {
        try {
            engine.submitTask(t);
            console.error(`[FAIL] Malformed task ${i} was accepted!`);
        } catch (e) {
            console.log(`[OK] Malformed task ${i} rejected: ${e.message}`);
        }
    });

    // -------------------------------------------------------------------------
    // PHASE 2: Nonsensical Agent Outputs
    // -------------------------------------------------------------------------
    console.log('\n--- PHASE 2: NONSENSICAL AGENT OUTPUTS ---');

    // Override dispatchToAgent to simulate chaos
    const chaoticAgentId = 'chaotic_agent';
    engine.registerAgent({
        id: chaoticAgentId,
        domainLabels: ['logic'],
        skillScores: { logic: 10 },
        apiEndpoint: 'http://localhost/agents/chaotic',
        performanceData: { tasksCompleted: 0, successRate: 1.0, averageImpact: 5 }
    });

    let chaosMode = 'none';
    engine.dispatchToAgent = async (agent, task) => {
        console.log(`[CHAOS] Dispatching in mode: ${chaosMode}`);
        switch (chaosMode) {
            case 'null': return null;
            case 'undefined': return undefined;
            case 'missing_fields': return { resultData: 'Incomplete' };
            case 'wrong_types': return { confidenceScore: 'high', actualImpact: 'big', executionTime: 'long' };
            case 'nan': return { confidenceScore: NaN, actualImpact: NaN, executionTime: NaN };
            default:
                return {
                    resultData: 'Normal result',
                    confidenceScore: 0.9,
                    actualImpact: 5,
                    executionTime: 100
                };
        }
    };

    const chaosModes = ['null', 'undefined', 'missing_fields', 'wrong_types', 'nan'];
    for (const mode of chaosModes) {
        chaosMode = mode;
        console.log(`>> Testing chaos mode: ${mode}`);
        const taskId = engine.submitTask({
            description: `Chaos task for ${mode}`,
            domainLabel: 'logic',
            complexityScore: 5,
            priority: 10
        });

        try {
            await engine.processQueue();
            const output = engine.taskOutputs[taskId];
            const task = engine.taskQueue.find(t => t.id === taskId);
            console.log(`[STATUS] Task ${taskId} status: ${task.status}`);
            if (output) {
                console.log(`[OUTPUT] Task ${taskId} output received (might be corrupt)`);
            } else {
                console.log(`[OUTPUT] No output logged for ${taskId}`);
            }
        } catch (e) {
            console.error(`[CRASH] Engine crashed in mode ${mode}: ${e.message}`);
        }
    }

    // -------------------------------------------------------------------------
    // PHASE 3: Direct Queue Contamination (Bypassing validation)
    // -------------------------------------------------------------------------
    console.log('\n--- PHASE 3: DIRECT QUEUE CONTAMINATION ---');
    console.log('>> Injecting toxic tasks directly into taskQueue...');

    const toxicTasks = [
        { id: 'toxic_1', status: 'pending', description: null, domainLabel: null }, // Null fields
        { id: 'toxic_2', status: 'pending', domainLabel: 'non-existent' }, // Invalid domain
        { id: 'toxic_3', status: 'pending', dependencies: ['non-existent-task'] } // Dead dependency
    ];

    toxicTasks.forEach(t => engine.taskQueue.push(t));

    try {
        console.log('>> Processing queue with toxic tasks...');
        // Process many times to see if they eventually fail
        for (let i = 0; i < 30; i++) {
            await engine.processQueue();
        }
        console.log('[OK] Engine survived toxic task processing.');
    } catch (e) {
        console.error(`[CRASH] Engine crashed on toxic tasks: ${e.message}`);
        console.error(e.stack);
    }

    // -------------------------------------------------------------------------
    // PHASE 4: Valid Tasks Amidst Chaos
    // -------------------------------------------------------------------------
    console.log('\n--- PHASE 4: VALID TASKS AMIDST CHAOS ---');
    chaosMode = 'none'; // Restore normality
    const validTaskIds = [];
    for (let i = 0; i < 5; i++) {
        validTaskIds.push(engine.submitTask({
            description: `Sanity check task ${i}`,
            domainLabel: 'analysis',
            complexityScore: 3
        }));
    }

    console.log('>> Processing remaining tasks...');
    let timeout = 0;
    while (engine.taskQueue.some(t => t.status === 'pending' || t.status === 'processing') && timeout < 20) {
        await engine.processQueue();
        timeout++;
    }

    const completedCount = engine.taskQueue.filter(t => t.status === 'completed').length;
    const failedCount = engine.taskQueue.filter(t => t.status === 'failed').length;
    console.log(`Simulation finished. Completed: ${completedCount}, Failed: ${failedCount}`);

    if (engine.taskQueue.some(t => t.description && t.description.startsWith('Sanity check') && t.status === 'completed')) {
        console.log('[EVALUATION] SUCCESS: Engine processed valid tasks after recovering from/ignoring edge cases.');
    } else {
        console.error('[EVALUATION] FAILURE: Valid tasks were not processed correctly.');
    }

    // Check logs for specific events
    console.log('\n--- LOG REVIEW (Summary) ---');
    const toxicTask1 = engine.taskQueue.find(t => t.id === 'toxic_1');
    console.log(`Toxic Task 1 Status: ${toxicTask1 ? toxicTask1.status : 'missing'}`);

    const toxicTask3 = engine.taskQueue.find(t => t.id === 'toxic_3');
    console.log(`Toxic Task 3 Status: ${toxicTask3 ? toxicTask3.status : 'missing'}`);

    process.exit(0);
}

runEdgeCaseSimulation().catch(e => {
    console.error('Fatal Simulation Error:', e);
    process.exit(1);
});
