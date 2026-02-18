import logger from '../logger/Logger.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Lightweight Orchestration Core (LOC) Engine
 * Manages agents, tasks, and workflow monitoring.
 */
class CoreEngine {
    constructor() {
        /**
         * Mapping of Agent IDs to Agent Metadata
         * Metadata includes: domainLabels, skillScores, apiEndpoints, historicalPerformance
         * @type {Object.<string, Object>}
         */
        this.agents = {};

        /**
         * Structured Task Queue
         * @type {Array.<Object>}
         */
        this.taskQueue = [];

        /**
         * Task results and tracking
         * @type {Object.<string, Object>}
         */
        this.taskOutputs = {};

        logger.info('ENGINE_INIT', 'Core Engine initialized successfully');
    }

    /**
     * Registers a new agent in the system
     * @param {Object} metadata agent details
     * @returns {string} The registered Agent ID
     */
    registerAgent(metadata) {
        const agentId = metadata.id || `agent_${Object.keys(this.agents).length + 1}`;

        this.agents[agentId] = {
            id: agentId,
            domainLabels: metadata.domainLabels || [],
            skillScores: metadata.skillScores || {},
            apiEndpoint: metadata.apiEndpoint || '',
            performanceData: metadata.performanceData || {
                tasksCompleted: 0,
                successRate: 0,
                averageImpact: 0,
                lastActive: null
            },
            status: 'idle',
            ...metadata
        };

        logger.info('AGENT_REGISTERED', `Agent ${agentId} registered`, { agentId, domainLabels: this.agents[agentId].domainLabels });
        return agentId;
    }

    /**
     * Submits a new task to the queue
     * @param {Object} taskData Details of the task
     * @returns {string} The submitted Task ID
     */
    submitTask(taskData) {
        const taskId = `task_${uuidv4()}`;
        const task = {
            id: taskId,
            status: 'pending',
            priority: taskData.priority || 1,
            requirements: taskData.requirements || {},
            payload: taskData.payload || {},
            timestamp: new Date().toISOString(),
            assignedTo: null,
            ...taskData
        };

        this.taskQueue.push(task);
        // Sort by priority (higher first)
        this.taskQueue.sort((a, b) => b.priority - a.priority);

        logger.info('TASK_SUBMITTED', `Task ${taskId} submitted to queue`, { taskId, priority: task.priority });
        return taskId;
    }

    /**
     * Assigns pending tasks to available agents based on expertise
     * (Basic implementation for Substep 1)
     */
    assignTasks() {
        const pendingTasks = this.taskQueue.filter(t => t.status === 'pending');

        for (const task of pendingTasks) {
            const bestAgentId = this.findBestAgentForTask(task);

            if (bestAgentId) {
                task.status = 'assigned';
                task.assignedTo = bestAgentId;
                this.agents[bestAgentId].status = 'busy';

                logger.info('TASK_ASSIGNED', `Task ${task.id} assigned to agent ${bestAgentId}`, {
                    taskId: task.id,
                    agentId: bestAgentId
                });
            }
        }
    }

    /**
     * Finds the most suitable agent for a task
     * @param {Object} task 
     * @returns {string|null} Agent ID or null
     */
    findBestAgentForTask(task) {
        const availableAgents = Object.values(this.agents).filter(a => a.status === 'idle');

        if (availableAgents.length === 0) return null;

        // Basic matching logic: check domain labels
        // We'll expand this later with predicted success and impact
        const matchedAgents = availableAgents.filter(agent =>
            agent.domainLabels.some(label => task.requirements?.domains?.includes(label))
        );

        const candidates = matchedAgents.length > 0 ? matchedAgents : availableAgents;

        // Pick the one with the highest skill score for the relevant domain if applicable
        // Otherwise pick the first available
        return candidates[0].id;
    }

    /**
     * Logs the output for a task
     * @param {string} taskId 
     * @param {Object} output 
     */
    logOutput(taskId, output) {
        this.taskOutputs[taskId] = {
            output,
            timestamp: new Date().toISOString()
        };

        const task = this.taskQueue.find(t => t.id === taskId);
        if (task) {
            task.status = 'completed';
            if (task.assignedTo && this.agents[task.assignedTo]) {
                this.agents[task.assignedTo].status = 'idle';
                this.updateAgentPerformance(task.assignedTo, output.success);
            }
        }

        logger.info('TASK_COMPLETED', `Output logged for task ${taskId}`, {
            taskId,
            success: output.success
        });
    }

    /**
     * Internal: Update agent performance metrics
     * @param {string} agentId 
     * @param {boolean} success 
     */
    updateAgentPerformance(agentId, success) {
        const agent = this.agents[agentId];
        const perf = agent.performanceData;

        perf.tasksCompleted += 1;
        const totalSuccesses = (perf.successRate * (perf.tasksCompleted - 1)) + (success ? 1 : 0);
        perf.successRate = totalSuccesses / perf.tasksCompleted;
        perf.lastActive = new Date().toISOString();
    }
}

export default CoreEngine;
