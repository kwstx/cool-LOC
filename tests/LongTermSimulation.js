import CoreEngine from '../src/engine/CoreEngine.js';
import logger from '../src/logger/Logger.js';

/**
 * Long-Term Orchestration Simulation
 * Tests the system's learning, stability, and predictive accuracy over a simulated long period.
 */
async function runLongTermSimulation() {
    console.log('--- STARTING LONG-TERM CONTINUOUS SIMULATION ---');
    const engine = new CoreEngine();

    const domains = ['logic', 'analysis', 'creative-writing', 'coding', 'research'];
    const agentProfiles = [
        { id: 'expert_logic', domains: ['logic'], skill: 9, reliability: 0.95 },
        { id: 'expert_analysis', domains: ['analysis'], skill: 9, reliability: 0.95 },
        { id: 'expert_universal', domains: domains, skill: 8, reliability: 0.90 },
        { id: 'junior_coding', domains: ['coding'], skill: 4, reliability: 0.70 },
        { id: 'unreliable_jack', domains: domains, skill: 5, reliability: 0.40 },
        { id: 'flaky_researcher', domains: ['research'], skill: 7, reliability: 0.50 },
        { id: 'novice_all', domains: domains, skill: 3, reliability: 0.60 }
    ];

    console.log('>>> Registering Agents...');
    agentProfiles.forEach(profile => {
        engine.registerAgent({
            id: profile.id,
            domainLabels: profile.domains,
            skillScores: profile.domains.reduce((acc, d) => ({ ...acc, [d]: profile.skill }), {}),
            apiEndpoint: `http://localhost/agents/${profile.id}`,
            performanceData: {}
        });
    });

    // Custom dispatch to simulate agent behavior based on profiles
    const originalDispatch = engine.dispatchToAgent.bind(engine);
    engine.dispatchToAgent = async (agent, task) => {
        const profile = agentProfiles.find(p => p.id === agent.id);
        const reliability = profile ? profile.reliability : 0.8;

        // Add randomness based on task complexity
        const adjustedReliability = reliability - (task.complexityScore / 20);
        const roll = Math.random();

        return new Promise((resolve, reject) => {
            setTimeout(() => {
                if (roll > adjustedReliability) {
                    // Simulated failure
                    if (roll > 0.95) {
                        reject(new Error('CRITICAL_AGENT_FAILURE'));
                    } else {
                        // Soft failure: Low confidence/Impact
                        resolve({
                            resultData: 'SUBOPTIMAL_OUTPUT',
                            confidenceScore: parseFloat((Math.random() * 0.4 + 0.1).toFixed(2)),
                            actualImpact: parseFloat((task.predictedImpact * 0.2).toFixed(1)),
                            executionTime: 200
                        });
                    }
                } else {
                    // Success
                    resolve({
                        resultData: `High-quality result for ${task.description}`,
                        confidenceScore: parseFloat((Math.random() * 0.2 + 0.8).toFixed(2)),
                        actualImpact: parseFloat((task.predictedImpact * (Math.random() * 0.4 + 0.8)).toFixed(1)),
                        executionTime: 100 + (task.complexityScore * 20)
                    });
                }
            }, 10); // Fast simulation
        });
    };

    const SIMULATION_STEPS = 10; // Total "days"
    const TASKS_PER_STEP = 5;

    // Attempt to silence the logger to make console cleaner
    // (Assuming logger has a way to set level, or we just ignore its output)

    const history = {
        successRates: [],
        assignments: {},
        predictionAccuracy: []
    };

    agentProfiles.forEach(p => history.assignments[p.id] = []);

    console.log(`>>> Running for ${SIMULATION_STEPS} simulation steps...`);

    for (let step = 1; step <= SIMULATION_STEPS; step++) {
        // 1. Inject Tasks
        for (let i = 0; i < TASKS_PER_STEP; i++) {
            engine.submitTask({
                description: `Step ${step} - Task ${i}`,
                domainLabel: domains[Math.floor(Math.random() * domains.length)],
                complexityScore: Math.floor(Math.random() * 10) + 1,
                priority: Math.floor(Math.random() * 5) + 1
            });
        }

        // 2. Process all pending tasks in this step
        let stepProcessed = 0;
        while (true) {
            const pending = engine.taskQueue.filter(t => t.status === 'pending');
            const processing = engine.taskQueue.filter(t => t.status === 'processing');
            const waiting = engine.taskQueue.filter(t => t.status === 'waiting_for_subtasks');

            if (pending.length === 0 && processing.length === 0 && waiting.length === 0) break;

            const idleAgents = Object.values(engine.agents).filter(a => a.status === 'idle');
            if (idleAgents.length > 0 && pending.length > 0) {
                // Process a batch
                const batchSize = Math.min(idleAgents.length, pending.length);
                const batch = [];
                for (let b = 0; b < batchSize; b++) {
                    batch.push(engine.processQueue());
                }
                await Promise.all(batch);
            } else if (processing.length > 0 || waiting.length > 0) {
                // Wait for existing ones to finish
                await new Promise(r => setTimeout(r, 5)); // Faster wait
            } else {
                break;
            }

            stepProcessed++;
            if (stepProcessed > 1000) break;
        }

        // 3. Record Snapshot Metrics
        const completedCount = engine.taskQueue.filter(t => t.status === 'completed').length;
        const failedCount = engine.taskQueue.filter(t => t.status === 'failed').length;
        const totalProcessed = completedCount + failedCount;
        const successRate = totalProcessed > 0 ? (completedCount / totalProcessed) : 0;
        history.successRates.push(successRate);

        agentProfiles.forEach(p => {
            const agentTasks = engine.taskQueue.filter(t => t.assignedTo === p.id).length;
            history.assignments[p.id].push(agentTasks);
        });

        if (step % 5 === 0) {
            process.stdout.write(`\rProgress: ${step}/${SIMULATION_STEPS} steps complete...`);
        }
    }
    console.log('\nProcessing final queue...');
    // Final flush
    for (let i = 0; i < 50; i++) {
        await engine.processQueue();
        await new Promise(r => setTimeout(r, 5));
    }

    console.log('\n--- LONG-TERM SIMULATION RESULTS ---');
    console.log(`Total Tasks Submitted: ${engine.taskQueue.length}`);
    const completed = engine.taskQueue.filter(t => t.status === 'completed').length;
    const failed = engine.taskQueue.filter(t => t.status === 'failed').length;
    console.log(`Final Success Rate: ${((completed / (completed + failed)) * 100).toFixed(1)}%`);

    console.log('\n>>> Agent Usage Evolution (Initial vs Final):');
    agentProfiles.forEach(p => {
        const startUsage = history.assignments[p.id][0] || 0;
        const endUsage = history.assignments[p.id][SIMULATION_STEPS - 1] - (history.assignments[p.id][SIMULATION_STEPS - 6] || 0); // Usage in last 5 steps
        const totalUsage = engine.taskQueue.filter(t => t.assignedTo === p.id).length;
        const avgSuccess = engine.agents[p.id].performanceData.successRate;
        console.log(`${p.id.padEnd(20)} Total Hits: ${totalUsage.toString().padEnd(4)} | Success Rate: ${(avgSuccess * 100).toFixed(1)}% | Reliability Profile: ${p.reliability}`);
    });

    // 4. Analysis
    const expertUsage = (engine.taskQueue.filter(t => t.assignedTo?.startsWith('expert')).length);
    const unreliableUsage = (engine.taskQueue.filter(t => t.assignedTo === 'unreliable_jack' || t.assignedTo === 'novice_all').length);

    console.log(`\nExpert Tier Total Assignments: ${expertUsage}`);
    console.log(`Unreliable Tier Total Assignments: ${unreliableUsage}`);

    if (expertUsage > unreliableUsage * 2) {
        console.log('\n[LEARNING CHECK] SUCCESS: The system correctly preferred experts over unreliable agents over time.');
    } else {
        console.log('\n[LEARNING CHECK] OBSERVATION: Unreliable agents still received significant assignments. This might be due to expert saturation or insufficient penalty in meta-reflection.');
    }

    // Check for drift/catastrophe
    const finalStepTasks = engine.taskQueue.filter(t => t.status === 'pending');
    if (finalStepTasks.length > 50) {
        console.log('\n[STABILITY CHECK] WARNING: Large task backlog detected. System might be slowing down or stalling.');
    } else {
        console.log('\n[STABILITY CHECK] SUCCESS: Queue remained manageable.');
    }

    // Predictive model updates
    console.log('\n>>> Meta-Reflection Sample Predictions (Logic Domain):');
    agentProfiles.forEach(p => {
        const prediction = engine.metaReflection.predictSuccess(engine.agents[p.id], { domainLabel: 'logic', complexityScore: 5 });
        console.log(`${p.id.padEnd(20)} Predicted Success for Logic(5): ${prediction}`);
    });

    process.exit(0);
}

runLongTermSimulation().catch(e => {
    console.error('Simulation Failed:', e);
    process.exit(1);
});
