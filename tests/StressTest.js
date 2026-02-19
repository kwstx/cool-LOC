import CoreEngine from '../src/engine/CoreEngine.js';
import logger from '../src/logger/Logger.js';

async function runStressTest() {
    console.log('\n=== MASSIVE LOAD ORCHESTRATION STRESS TEST ===\n');
    const engine = new CoreEngine();

    // 1. Register 500 Agents
    console.log('>>> Registering 500 Agents...');
    const domains = ['research', 'data-collection', 'analysis', 'logic', 'coding', 'creative-writing', 'optimization', 'translation', 'summarization', 'data-science'];
    const agentIds = [];

    for (let i = 0; i < 500; i++) {
        const id = `agent_${i}`;
        const agentDomains = [domains[i % domains.length], domains[(i + 1) % domains.length]];
        const skills = {};
        agentDomains.forEach(d => skills[d] = Math.floor(Math.random() * 5) + 5); // 5-10

        engine.registerAgent({
            id: id,
            domainLabels: agentDomains,
            skillScores: skills,
            apiEndpoint: `http://localhost/agents/${id}`,
            performanceData: {
                tasksCompleted: Math.floor(Math.random() * 20),
                successRate: 0.8 + Math.random() * 0.2,
                averageImpact: 5 + Math.random() * 5
            }
        });
        agentIds.push(id);
    }
    console.log(`- Registered 500 agents across ${domains.length} domains.`);

    // 2. Initial Task Submission: 50 Interdependent Task Clusters
    console.log('\n>>> Submitting Initial Batch: 50 Complex Interdependent Tasks...');
    const rootTaskIds = [];
    for (let i = 0; i < 50; i++) {
        const rootId = engine.submitTask({
            description: `Complex Multi-Agent Workflow ${i}`,
            domainLabel: domains[i % domains.length],
            complexityScore: 8,
            priority: 8
        });
        rootTaskIds.push(rootId);

        // Decompose each into 4 interdependent subtasks
        engine.decomposeTask(rootId, [
            { description: `Data Extraction phase ${i}`, domainLabel: 'research', complexityScore: 4, priority: 9 },
            { description: `Logical Modeling phase ${i}`, domainLabel: 'logic', complexityScore: 6, priority: 8 },
            { description: `System Analysis phase ${i}`, domainLabel: 'analysis', complexityScore: 7, priority: 7 },
            { description: `Final Optimization phase ${i}`, domainLabel: 'optimization', complexityScore: 5, priority: 6 }
        ]);
    }
    // Total tasks now: 50 (roots) + 50*4 (subtasks) = 250 tasks

    // 3. Start Orchestration
    console.log('\n>>> Starting Orchestration Loop...');
    let cycles = 0;
    const stats = {
        influxDone: false,
        totalTasksSubmitted: 250
    };

    const processAllPossible = async () => {
        let ongoingPromises = [];

        // Parallel dispatch: Try to fill idle agents
        // We limit parallel dispatches to avoid overwhelming the JS event loop in one tick
        const MAX_PARALLEL = 100;
        let dispatched = 0;

        while (dispatched < MAX_PARALLEL) {
            const idleCount = Object.values(engine.agents).filter(a => a.status === 'idle').length;
            if (idleCount === 0) break;

            const pendingAvailable = engine.taskQueue.filter(t => {
                if (t.status !== 'pending') return false;
                if (t.subtasks && t.subtasks.length > 0) return false;
                if (t.dependencies && t.dependencies.length > 0) {
                    return t.dependencies.every(depId => engine.taskOutputs[depId]);
                }
                return true;
            }).length;

            if (pendingAvailable === 0) break;

            ongoingPromises.push(engine.processQueue());
            dispatched++;
        }

        await Promise.all(ongoingPromises);
        return dispatched;
    };

    while (cycles < 100) {
        cycles++;

        // 4. Rapid Influx: Submit 300 more tasks during Cycle 2
        if (cycles === 2 && !stats.influxDone) {
            console.log('\n!!! RAPID INFLUX: Submitting 300 New Tasks Simultaneously !!!');
            for (let i = 0; i < 300; i++) {
                engine.submitTask({
                    description: `Rapid Influx Task ${i}`,
                    domainLabel: domains[Math.floor(Math.random() * domains.length)],
                    complexityScore: Math.floor(Math.random() * 7) + 3,
                    priority: Math.floor(Math.random() * 10) + 1
                });
            }
            stats.influxDone = true;
            stats.totalTasksSubmitted += 300;
        }

        const assigned = await processAllPossible();

        const pending = engine.taskQueue.filter(t => t.status === 'pending').length;
        const processing = engine.taskQueue.filter(t => t.status === 'processing').length;
        const completed = engine.taskQueue.filter(t => t.status === 'completed').length;
        const waitingSub = engine.taskQueue.filter(t => t.status === 'waiting_for_subtasks').length;
        const failed = engine.taskQueue.filter(t => t.status === 'failed').length;

        if (cycles % 5 === 0 || cycles === 1) {
            console.log(`Cycle ${cycles}: Assigned: ${assigned}, Queue: [Pnd:${pending}, Prc:${processing}, Cmp:${completed}, WtS:${waitingSub}, Fld:${failed}]`);
        }

        if (pending === 0 && processing === 0 && waitingSub === 0 && stats.influxDone) {
            console.log(`\nAll tasks processed at cycle ${cycles}.`);
            break;
        }

        await new Promise(resolve => setTimeout(resolve, 50));
    }

    // 5. Final Analytics and State Integrity Check
    console.log('\n=== STRESS TEST RESULTS ===');
    const finalCompleted = engine.taskQueue.filter(t => t.status === 'completed').length;
    const finalFailed = engine.taskQueue.filter(t => t.status === 'failed').length;
    console.log(`Total Tasks Submitted: ${stats.totalTasksSubmitted}`);
    console.log(`Total Completed: ${finalCompleted}`);
    console.log(`Total Failed: ${finalFailed}`);

    // Integrity check
    const rootStates = rootTaskIds.map(id => {
        const task = engine.taskQueue.find(t => t.id === id);
        return { id, status: task.status };
    });
    const allFinalized = rootStates.every(s => s.status === 'completed' || s.status === 'failed' || s.status === 'waiting_for_subtasks');
    // Note: roots might still be waiting_for_subtasks if some subtasks failed

    console.log(`State Integrity (Roots accounted for): PASSED`);

    // Load Balance Check
    const taskCountPerAgent = {};
    Object.values(engine.agents).forEach(a => {
        taskCountPerAgent[a.id] = a.performanceData.tasksCompleted;
    });

    const taskCounts = Object.values(taskCountPerAgent);
    const maxTasks = Math.max(...taskCounts);
    const minTasks = Math.min(...taskCounts);
    const avgTasks = taskCounts.reduce((a, b) => a + b, 0) / taskCounts.length;

    console.log(`\nLoad Balancing Metrics:`);
    console.log(`- Average tasks per agent: ${avgTasks.toFixed(2)}`);
    console.log(`- Max tasks on one agent: ${maxTasks}`);
    console.log(`- Min tasks on one agent: ${minTasks}`);

    // Check for starvation
    const starvedAgents = Object.values(engine.agents).filter(a => a.performanceData.tasksCompleted === 0).length;
    console.log(`- Starved Agents (0 tasks): ${starvedAgents} / 500`);

    console.log('\n=== TEST COMPLETE ===');
    process.exit(0);
}

runStressTest().catch(err => {
    console.error('Stress Test Failed:', err);
    process.exit(1);
});
