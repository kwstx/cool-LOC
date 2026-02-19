import logger from '../logger/Logger.js';

/**
 * Meta-Reflection Module
 * Tracks agent confidence, uncertainty, and historical performance.
 * Calculates predicted success and suggests execution strategies.
 */
class MetaReflectionModule {
    constructor(core) {
        this.core = core;
        this.threshold = 0.65; // Success probability threshold
    }

    /**
     * Calculates predicted success probability for an agent on a specific task.
     * @param {Object} agent 
     * @param {Object} task 
     * @returns {number} 0.0 to 1.0
     */
    predictSuccess(agent, task) {
        const domain = task.domainLabel;

        // Ensure performanceData exists and has domain tracking
        if (!agent.performanceData.domains) {
            agent.performanceData.domains = {};
        }

        const domainPerf = agent.performanceData.domains[domain] || {
            successRate: 0.5, // Default for new domain
            tasksCompleted: 0,
            uncertainty: 1.0
        };

        // 1. Skill fit (0.0 - 1.0)
        const skillScore = (agent.skillScores?.[domain] || (Object.values(agent.skillScores || {}).reduce((a, b) => a + b, 0) / 10) || 5) / 10;

        // 2. Historical success in this domain
        const historyScore = domainPerf.successRate;

        // 3. Uncertainty: inverse of experience.
        const uncertainty = domainPerf.uncertainty || (1 / (domainPerf.tasksCompleted + 1));

        // Predicted probability: Weighted average of skill and history, adjusted by uncertainty
        const historyWeight = 1 - uncertainty;
        const skillWeight = uncertainty;

        let prediction = (historyScore * historyWeight) + (skillScore * skillWeight);

        // 4. Interference Check: Check for active tasks that reduce success probability
        if (task.interferedBy && Array.isArray(task.interferedBy)) {
            const activeInterferences = this.core.taskQueue.filter(t =>
                task.interferedBy.includes(t.domainLabel) &&
                (t.status === 'processing' || t.status === 'completed')
            );

            if (activeInterferences.length > 0) {
                const reduction = activeInterferences.length * 0.15; // 15% reduction per interfering task
                prediction = Math.max(0.1, prediction - reduction);
                logger.warn('INTERFERENCE_DETECTED', `Task ${task.id} success probability reduced by ${reduction.toFixed(2)} due to ${activeInterferences.length} active/completed interfering tasks`, {
                    taskId: task.id,
                    activeInterferences: activeInterferences.map(i => i.id)
                });
            }
        }

        return parseFloat(prediction.toFixed(4));
    }

    /**
     * Evaluates the best agent and provides a success prediction.
     * @param {Object} task 
     * @param {string[]} excludeIds 
     * @returns {Object} { agentId, predictedSuccess }
     */
    evaluateAssignment(task, excludeIds = []) {
        const availableAgents = Object.values(this.core.agents).filter(a =>
            a.status === 'idle' && !excludeIds.includes(a.id)
        );

        if (availableAgents.length === 0) return { agentId: null, predictedSuccess: 0 };

        const evaluations = availableAgents.map(agent => ({
            id: agent.id,
            prediction: this.predictSuccess(agent, task)
        }));

        evaluations.sort((a, b) => b.prediction - a.prediction);
        const best = evaluations[0];

        return {
            agentId: best.id,
            predictedSuccess: best.prediction
        };
    }

    /**
     * Updates agent metadata with domain-specific performance and adjusts uncertainty.
     * @param {string} agentId 
     * @param {string} domain 
     * @param {boolean} success 
     * @param {number} impact 
     */
    updateAgentMetadata(agentId, domain, success, impact = 0) {
        const agent = this.core.agents[agentId];
        if (!agent) return;

        if (!agent.performanceData.domains) {
            agent.performanceData.domains = {};
        }

        if (!agent.performanceData.domains[domain]) {
            agent.performanceData.domains[domain] = {
                tasksCompleted: 0,
                successRate: 0,
                averageImpact: 0,
                uncertainty: 1.0,
                confidence: 0.5
            };
        }

        const dPerf = agent.performanceData.domains[domain];
        dPerf.tasksCompleted += 1;

        const prevSuccesses = (dPerf.successRate * (dPerf.tasksCompleted - 1));
        dPerf.successRate = (prevSuccesses + (success ? 1 : 0)) / dPerf.tasksCompleted;

        if (success) {
            const prevImpact = (dPerf.averageImpact * (dPerf.tasksCompleted - 1));
            dPerf.averageImpact = (prevImpact + impact) / dPerf.tasksCompleted;
        }

        // Uncertainty decreases asymptotically as we gain experience
        dPerf.uncertainty = 1 / (dPerf.tasksCompleted + 1);

        // Agent confidence is a blend of their success rate and certainty (1 - uncertainty)
        dPerf.confidence = (dPerf.successRate * 0.7) + ((1 - dPerf.uncertainty) * 0.3);

        logger.info('META_REFLECTION_UPDATE', `Updated metadata for agent ${agentId} in domain ${domain}`, {
            agentId,
            domain,
            successRate: dPerf.successRate.toFixed(2),
            uncertainty: dPerf.uncertainty.toFixed(2),
            confidence: dPerf.confidence.toFixed(2)
        });
    }

    /**
     * Estimates the potential impact of a task based on complexity, priority, and historical data.
     * @param {Object} task 
     * @returns {number} Estimated impact score
     */
    predictImpact(task) {
        const baseImpact = task.complexityScore || 5;
        const priorityMultiplier = 1 + ((task.priority || 1) / 10);

        // Get average impact for this domain from all agents who have worked on it
        let domainImpactSum = 0;
        let domainTaskCount = 0;

        for (const agent of Object.values(this.core.agents)) {
            const dPerf = agent.performanceData?.domains?.[task.domainLabel];
            if (dPerf && dPerf.tasksCompleted > 0) {
                domainImpactSum += (dPerf.averageImpact * dPerf.tasksCompleted);
                domainTaskCount += dPerf.tasksCompleted;
            }
        }

        const avgDomainImpact = domainTaskCount > 0 ? (domainImpactSum / domainTaskCount) : 5;

        // Heuristic: 60% base(complexity/priority), 40% historical domain average
        const predictedImpact = (baseImpact * priorityMultiplier * 0.6) + (avgDomainImpact * 0.4);

        return parseFloat(predictedImpact.toFixed(2));
    }

    /**
     * Determines best course of action when predicted success is low.
     * @param {Object} task 
     * @param {number} predictedSuccess 
     * @returns {string} 'SPLIT' | 'COLLABORATE' | 'REROUTE'
     */
    suggestRemediation(task, predictedSuccess) {
        // If complexity is high, splitting is preferred
        if (task.complexityScore > 6) {
            return 'SPLIT';
        }

        // If there are other agents with relevant skills, collaboration is preferred
        const otherAgents = Object.values(this.core.agents).filter(a =>
            a.domainLabels.includes(task.domainLabel) || (a.skillScores?.[task.domainLabel] || 0) > 4
        );

        if (otherAgents.length > 1) {
            return 'COLLABORATE';
        }

        // Otherwise, just try a different agent if available
        return 'REROUTE';
    }
}

export default MetaReflectionModule;
