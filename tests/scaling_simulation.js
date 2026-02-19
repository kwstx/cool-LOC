import CoreEngine from '../src/engine/CoreEngine.js';
import logger from '../src/logger/Logger.js';

async function runScalingSimulation() {
    console.log('\n=== FINAL SCALING SIMULATION & PARAMETER ADJUSTMENT ===\n');
    const engine = new CoreEngine();

    // 1. Parameter Adjustments
    console.log('>>> Adjusting Core Parameters');
    engine.metaReflection.threshold = 0.75; // Increased threshold for higher quality
    console.log(`- Success Threshold set to: ${engine.metaReflection.threshold}`);

    // 2. Dynamic Agent Registration (Scaling to 5 agents)
    console.log('\n>>> Registering Multiple Vocational Agents');
    const agents = [
        { id: 'research-pro', domains: ['research', 'data-collection'], skills: { research: 9, 'data-collection': 8 } },
        { id: 'analyst-master', domains: ['analysis', 'optimization'], skills: { analysis: 9.5, optimization: 8.5 } },
        { id: 'coder-senior', domains: ['coding', 'logic'], skills: { coding: 9, logic: 9 } },
        { id: 'writer-creative', domains: ['creative-writing', 'summarization'], skills: { 'creative-writing': 8.5, summarization: 8 } },
        { id: 'polymath-generalist', domains: ['research', 'analysis', 'logic'], skills: { research: 7, analysis: 7, logic: 7 } }
    ];

    agents.forEach(a => {
        engine.registerAgent({
            id: a.id,
            domainLabels: a.domains,
            skillScores: a.skills,
            apiEndpoint: `http://localhost/agents/${a.id}`,
            performanceData: { tasksCompleted: 5, successRate: 0.9, averageImpact: 7.5 } // Seeded performance
        });
    });

    // 3. High-Load Task Submission
    console.log('\n>>> Submitting Batch of Diverse Tasks');
    const taskSpecs = [
        { description: 'Deep Research on Quantum Computing', domainLabel: 'research', complexityScore: 8, priority: 9 },
        { description: 'Optimize Data Pipeline Architecture', domainLabel: 'optimization', complexityScore: 7, priority: 6 },
        { description: 'Implement Secure Auth Module', domainLabel: 'coding', complexityScore: 9, priority: 10 },
        { description: 'Draft Annual Sustainability Report', domainLabel: 'creative-writing', complexityScore: 5, priority: 4 },
        { description: 'Logical Verification of Smart Contract', domainLabel: 'logic', complexityScore: 8, priority: 7 },
        { description: 'Market Analysis for European Expansion', domainLabel: 'analysis', complexityScore: 6, priority: 5 }
    ];

    const taskIds = taskSpecs.map(spec => engine.submitTask(spec));

    // 4. Orchestration Loop
    console.log('\n>>> Running Orchestration Loop');
    let cycles = 0;
    const maxCycles = 15; // Enough to process everything including subtasks

    while (cycles < maxCycles) {
        cycles++;
        console.log(`\n--- Cycle ${cycles} ---`);
        await engine.processQueue();

        // Check if any agent completed a task recently (async simulation)
        await new Promise(resolve => setTimeout(resolve, 300));

        const pendingCount = engine.taskQueue.filter(t => t.status === 'pending').length;
        const processingCount = engine.taskQueue.filter(t => t.status === 'processing').length;
        const completedCount = engine.taskQueue.filter(t => t.status === 'completed').length;

        console.log(`Pending: ${pendingCount}, Processing: ${processingCount}, Completed: ${completedCount}`);

        if (pendingCount === 0 && processingCount === 0) {
            console.log('All tasks processed.');
            break;
        }
    }

    // 5. Success Rate and Impact Monitoring
    console.log('\n=== SIMULATION RESULTS & IMPACT REPORT ===');
    const totalTasks = engine.taskQueue.length;
    const completedTasks = engine.taskQueue.filter(t => t.status === 'completed' && t.id !== 'AGGREGATOR_SYSTEM').length;
    const successfulTasks = Object.values(engine.taskOutputs).filter(o => o.confidenceScore >= 0.7).length;

    console.log(`Total Final Tasks (Incl Decomposed): ${totalTasks}`);
    console.log(`Successfully Completed: ${successfulTasks}`);

    const totalImpact = Object.values(engine.taskOutputs).reduce((sum, o) => sum + (o.actualImpact || 0), 0);
    console.log(`Total System-Wide Impact: ${totalImpact.toFixed(2)}`);

    console.log('\nAgent Collaboration Efficiency:');
    const collabTasks = engine.taskQueue.filter(t => t.isCollaborative).length;
    console.log(`Collaborative Tasks Orchestrated: ${collabTasks}`);
    console.log(`Collaboration logs generated: ${engine.collaborationLogs.length}`);

    console.log('\nFinal Agent Performance Metrics:');
    Object.entries(engine.agents).forEach(([id, agent]) => {
        const d = agent.performanceData;
        console.log(`- ${id}: SuccessRate: ${(d.successRate * 100).toFixed(1)}%, AvgImpact: ${d.averageImpact.toFixed(1)}, Tasks: ${d.tasksCompleted}`);
    });

    console.log('\nCore Scaling Ready for Integration with Payment and Rewards.');
}

runScalingSimulation().catch(err => {
    console.error('Simulation Failed:', err);
});
