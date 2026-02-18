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
         * @type {Object.<string, Object>}
         */
        this.agents = {};

        /**
         * Structured Task Queue
         * @type {Array.<Object>}
         */
        this.taskQueue = [];

        /**
         * Task results and tracking (Simulated Database)
         * @type {Object.<string, Object>}
         */
        this.taskOutputs = {};

        /**
         * Reference to the execution loop timer
         */
        this.executionTimer = null;

        logger.info('ENGINE_INIT', 'Core Engine initialized successfully');
    }

    /**
     * Starts the continuous execution loop
     * @param {number} intervalMs frequency of checking the queue
     */
    startExecutionLoop(intervalMs = 1000) {
        if (this.executionTimer) {
            logger.info('LOOP_ALREADY_RUNNING', 'Execution loop is already active');
            return;
        }

        logger.info('LOOP_STARTED', 'Execution loop started', { intervalMs });
        this.executionTimer = setInterval(() => {
            this.processQueue();
        }, intervalMs);
    }

    /**
     * Stops the execution loop
     */
    stopExecutionLoop() {
        if (this.executionTimer) {
            clearInterval(this.executionTimer);
            this.executionTimer = null;
            logger.info('LOOP_STOPPED', 'Execution loop stopped');
        }
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
        const validation = validateTask(taskData);
        if (!validation.isValid) {
            logger.error('TASK_SUBMISSION_FAILED', 'Task validation failed', { errors: validation.errors, taskData });
            throw new Error(`Invalid Task: ${validation.errors.join(' ')}`);
        }

        const taskId = `task_${uuidv4()}`;
        const task = {
            ...taskData,
            taskID: taskId,
            id: taskId,
            status: 'pending',
            timestamp: new Date().toISOString(),
            assignedTo: null,
            retryCount: 0
        };

        this.taskQueue.push(task);
        this.taskQueue.sort((a, b) => (b.priority || 1) - (a.priority || 1));

        logger.info('TASK_SUBMITTED', `Task ${taskId} submitted to queue`, {
            taskId,
            domainLabel: task.domainLabel,
            priority: task.priority || 1
        });

        return taskId;
    }

    /**
     * Dequeues and processes the next available task
     */
    async processQueue() {
        const nextTask = this.taskQueue.find(t => t.status === 'pending');
        if (!nextTask) return;

        const agentId = this.findBestAgentForTask(nextTask);
        if (!agentId) return;

        // Transition task to processing state
        nextTask.status = 'processing';
        nextTask.assignedTo = agentId;
        this.agents[agentId].status = 'busy';

        logger.info('TASK_DISPATCHED', `Dispatching task ${nextTask.id} to agent ${agentId}`, {
            taskId: nextTask.id,
            agentId
        });

        try {
            const result = await this.dispatchToAgent(this.agents[agentId], nextTask);
            this.logOutput(nextTask.id, agentId, result);
        } catch (error) {
            this.handleTaskFailure(nextTask, agentId, error);
        }
    }

    /**
     * Dispatches task to Agent API (Mocked Implementation)
     * @param {Object} agent 
     * @param {Object} task 
     * @returns {Promise<Object>} The structured output
     */
    async dispatchToAgent(agent, task) {
        // In a production environment, this would call the agent's API via fetch/axios
        // Here we simulate the response structure required by the system.

        return new Promise((resolve, reject) => {
            // Simulated network latency
            const timeout = setTimeout(() => {
                // Random failure simulation for error handling testing
                if (Math.random() < 0.1) {
                    reject(new Error('Agent API Connection Timeout'));
                    return;
                }

                const startTime = Date.now();
                // Simulate processing...
                const endTime = Date.now();

                resolve({
                    resultData: `Task "${task.description}" executed successfully.`,
                    confidenceScore: parseFloat((Math.random() * (0.99 - 0.7) + 0.7).toFixed(2)),
                    predictedImpact: parseFloat((Math.random() * (10 - 4) + 4).toFixed(1)),
                    executionTime: (endTime - startTime) + 150 // Mocked duration
                });
            }, 500);
        });
    }

    /**
     * Finds the most suitable agent for a task
     * @param {Object} task 
     * @returns {string|null} Agent ID or null
     */
    findBestAgentForTask(task) {
        const availableAgents = Object.values(this.agents).filter(a => a.status === 'idle');
        if (availableAgents.length === 0) return null;

        const matchedAgents = availableAgents.filter(agent =>
            agent.domainLabels.includes(task.domainLabel)
        );

        const candidates = matchedAgents.length > 0 ? matchedAgents : availableAgents;
        return candidates[0].id; // Simple FIFO selection for now
    }

    /**
     * Logs the final output in the "database"
     * @param {string} taskId 
     * @param {string} agentId 
     * @param {Object} output 
     */
    logOutput(taskId, agentId, output) {
        const timestamp = new Date().toISOString();

        // Final structured record as per requirements
        this.taskOutputs[taskId] = {
            taskId,
            agentId,
            timestamp,
            resultData: output.resultData,
            confidenceScore: output.confidenceScore,
            predictedImpact: output.predictedImpact,
            executionTime: output.executionTime
        };

        const task = this.taskQueue.find(t => t.id === taskId);
        if (task) {
            task.status = 'completed';
            if (this.agents[agentId]) {
                this.agents[agentId].status = 'idle';
                this.updateAgentPerformance(agentId, true, output.predictedImpact);
            }
        }

        logger.info('TASK_COMPLETED', `Task ${taskId} completed and logged`, {
            taskId,
            agentId,
            confidence: output.confidenceScore
        });
    }

    /**
     * Error handling for failed tasks
     * @param {Object} task 
     * @param {string} agentId 
     * @param {Error} error 
     */
    handleTaskFailure(task, agentId, error) {
        logger.error('TASK_FAILED', `Task ${task.id} failed by ${agentId}`, error);

        if (this.agents[agentId]) {
            this.agents[agentId].status = 'idle';
            this.updateAgentPerformance(agentId, false);
        }

        task.retryCount += 1;

        if (task.retryCount < 3) {
            logger.info('TASK_REASSIGNMENT', `Flagging task ${task.id} for reassignment (Retry ${task.retryCount}/3)`);
            task.status = 'pending';
            task.assignedTo = null;
        } else {
            task.status = 'failed';
            logger.error('TASK_ABORTED', `Task ${task.id} failed after maximum retries.`);
        }
    }

    /**
     * Update agent performance metrics
     */
    updateAgentPerformance(agentId, success, impact = 0) {
        const agent = this.agents[agentId];
        const perf = agent.performanceData;

        perf.tasksCompleted += 1;
        const previousSuccesses = (perf.successRate * (perf.tasksCompleted - 1));
        perf.successRate = (previousSuccesses + (success ? 1 : 0)) / perf.tasksCompleted;

        if (success) {
            const previousImpactTotal = (perf.averageImpact * (perf.tasksCompleted - 1));
            perf.averageImpact = (previousImpactTotal + impact) / perf.tasksCompleted;
        }

        perf.lastActive = new Date().toISOString();
    }
}

export default CoreEngine;
