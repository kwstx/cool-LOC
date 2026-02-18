import logger from '../logger/Logger.js';
import { v4 as uuidv4 } from 'uuid';
import { validateTask } from './TaskValidator.js';

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
     * @throws {Error} if task validation fails
     */
    submitTask(taskData) {
        const validation = validateTask(taskData);
        if (!validation.isValid) {
            logger.error('TASK_SUBMISSION_FAILED', 'Task validation failed', { errors: validation.errors, taskData });
            throw new Error(`Invalid Task: ${validation.errors.join(' ')}`);
        }

        const taskId = `task_${uuidv4()}`;
        const task = {
            ...taskData,
            taskID: taskId,           // Unique ID as per schema
            id: taskId,               // Internal ID reference
            status: 'pending',
            timestamp: new Date().toISOString(),
            assignedTo: null
        };

        this.taskQueue.push(task);
        // Sort by priority (higher first, default to 1)
        this.taskQueue.sort((a, b) => (b.priority || 1) - (a.priority || 1));

        logger.info('TASK_SUBMITTED', `Task ${taskId} submitted to queue`, {
            taskId,
            domainLabel: task.domainLabel,
            complexityScore: task.complexityScore,
            priority: task.priority || 1
        });

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

        // Matching logic: check if the task's domainLabel is supported by the agent
        const matchedAgents = availableAgents.filter(agent =>
            agent.domainLabels.includes(task.domainLabel)
        );

        const candidates = matchedAgents.length > 0 ? matchedAgents : availableAgents;

        // Pick the first available candidate (could be refined with skill scores later)
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
