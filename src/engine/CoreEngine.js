import logger from '../logger/Logger.js';
import { v4 as uuidv4 } from 'uuid';
import { validateTask } from './TaskValidator.js';
import { validateAgent } from './AgentValidator.js';
import MetaReflectionModule from './MetaReflectionModule.js';

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
         * Collaboration logs for performance analysis
         * @type {Array.<Object>}
         */
        this.collaborationLogs = [];

        /**
         * Shared data space for tasks to communicate
         * @type {Object.<string, Object>}
         */
        this.collaborationSpace = {};

        /**
         * Reference to the execution loop timer
         */
        this.executionTimer = null;

        /**
         * Meta-Reflection Module for performance tracking and strategy suggestions
         * @type {MetaReflectionModule}
         */
        this.metaReflection = new MetaReflectionModule(this);

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
        const validation = validateAgent(metadata, this.agents);
        if (!validation.isValid) {
            logger.error('AGENT_REGISTRATION_FAILED', 'Agent validation failed', { errors: validation.errors, metadata });
            throw new Error(`Invalid Agent Registration: ${validation.errors.join(' ')}`);
        }

        const agentId = metadata.id || `agent_${uuidv4().split('-')[0]}`;

        this.agents[agentId] = {
            id: agentId,
            domainLabels: metadata.domainLabels,
            skillScores: metadata.skillScores,
            apiEndpoint: metadata.apiEndpoint,
            performanceData: {
                tasksCompleted: metadata.performanceData.tasksCompleted || 0,
                successRate: metadata.performanceData.successRate || 0,
                averageImpact: metadata.performanceData.averageImpact || 0,
                lastActive: metadata.performanceData.lastActive || null,
                ...metadata.performanceData
            },
            status: 'idle',
            registeredAt: new Date().toISOString()
        };

        logger.info('AGENT_REGISTERED', `Agent ${agentId} registered with domains: ${this.agents[agentId].domainLabels.join(', ')}`, {
            agentId,
            domainLabels: this.agents[agentId].domainLabels,
            apiEndpoint: this.agents[agentId].apiEndpoint,
            skillScores: this.agents[agentId].skillScores
        });

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
            retryCount: 0,
            failedAgents: [],
            dependencies: taskData.dependencies || [],
            subtasks: [], // Store IDs of subtasks
            parentTaskId: taskData.parentTaskId || null
        };

        // Predictive Impact Calculation
        task.predictedImpact = this.metaReflection.predictImpact(task);

        this.taskQueue.push(task);

        // Prioritize by Priority first, then Predicted Impact
        this.taskQueue.sort((a, b) => {
            const priorityDiff = (b.priority || 1) - (a.priority || 1);
            if (priorityDiff !== 0) return priorityDiff;
            return (b.predictedImpact || 0) - (a.predictedImpact || 0);
        });

        logger.info('TASK_SUBMITTED', `Task ${taskId} submitted to queue (Impact: ${task.predictedImpact})`, {
            taskId,
            domainLabel: task.domainLabel,
            priority: task.priority || 1,
            predictedImpact: task.predictedImpact
        });

        return taskId;
    }

    /**
     * Alias for processQueue for backward compatibility
     */
    async assignTasks() {
        return this.processQueue();
    }

    /**
     * Dequeues and processes the next available task
     */
    async processQueue() {
        const nextTask = this.taskQueue.find(t => {
            if (t.status !== 'pending') return false;

            // If it has initialized subtasks, it's a parent waiting for them
            if (t.subtasks && t.subtasks.length > 0) return false;

            // Dependency check: all dependency tasks must be completed
            if (t.dependencies && t.dependencies.length > 0) {
                const allDepsMet = t.dependencies.every(depId => {
                    const depTask = this.taskQueue.find(task => task.id === depId);
                    return depTask && depTask.status === 'completed';
                });
                if (!allDepsMet) return false;
            }

            return true;
        });

        if (!nextTask) return;

        const { agentId, predictedSuccess } = this.metaReflection.evaluateAssignment(nextTask, nextTask.failedAgents || []);
        if (!agentId) return;

        // Meta-Reflection Check: Before assigning, check predicted success probability
        if (predictedSuccess < this.metaReflection.threshold) {
            const strategy = this.metaReflection.suggestRemediation(nextTask, predictedSuccess);

            logger.warn('LOW_PREDICTED_SUCCESS', `Task ${nextTask.id} has low predicted success (${predictedSuccess}). Applying strategy: ${strategy}`, {
                taskId: nextTask.id,
                agentId,
                strategy
            });

            if (strategy === 'SPLIT') {
                this.handleTaskSplitting(nextTask);
                return;
            } else if (strategy === 'COLLABORATE') {
                this.handleTaskCollaboration(nextTask);
                // Proceed with collaboration flag
            } else if (strategy === 'REROUTE') {
                // Return to queue, effectively waiting for a more suitable agent or state
                logger.info('TASK_REROUTED', `Task ${nextTask.id} rerouted/delayed for better agent compatibility`);
                return;
            }
        }

        // Transition task to processing state
        nextTask.status = 'processing';
        nextTask.assignedTo = agentId;
        nextTask.predictedSuccess = predictedSuccess;
        this.agents[agentId].status = 'busy';

        logger.info('TASK_DISPATCHED', `Dispatching task ${nextTask.id} to agent ${agentId} (Prob: ${predictedSuccess})`, {
            taskId: nextTask.id,
            agentId,
            predictedSuccess
        });

        try {
            const result = await this.dispatchToAgent(this.agents[agentId], nextTask);

            // Logic for dynamic reassignment if confidence is too low
            const CONFIDENCE_THRESHOLD = 0.6;
            if (result.confidenceScore < CONFIDENCE_THRESHOLD) {
                logger.warn('LOW_CONFIDENCE_REASSIGNMENT', `Agent ${agentId} reported low confidence (${result.confidenceScore}) for task ${nextTask.id}. Reassigning...`, {
                    taskId: nextTask.id,
                    agentId,
                    confidenceScore: result.confidenceScore
                });

                this.handleTaskReassignment(nextTask, agentId, `Low confidence score: ${result.confidenceScore}`);
                return;
            }

            this.logOutput(nextTask.id, agentId, result);
        } catch (error) {
            this.handleTaskFailure(nextTask, agentId, error);
        }
    }

    /**
     * Splits a complex task into multiple subtasks with dependencies.
     * @param {string} parentTaskId The ID of the task to decompose
     * @param {Array<Object>} subtaskSpecs Definitions of the subtasks
     */
    decomposeTask(parentTaskId, subtaskSpecs) {
        const parentTask = this.taskQueue.find(t => t.id === parentTaskId);
        if (!parentTask) {
            logger.error('DECOMPOSITION_FAILED', `Parent task ${parentTaskId} not found`);
            throw new Error(`Parent task ${parentTaskId} not found`);
        }

        parentTask.status = 'waiting_for_subtasks';

        logger.info('TASK_DECOMPOSITION', `Decomposing complex task ${parentTaskId} into ${subtaskSpecs.length} subtasks`, {
            parentTaskId,
            subtaskCount: subtaskSpecs.length
        });

        for (const spec of subtaskSpecs) {
            const subtaskId = `subtask_${uuidv4()}`;
            const subtask = {
                ...spec,
                id: subtaskId,
                taskID: subtaskId,
                parentTaskId: parentTaskId,
                status: 'pending',
                dependencies: spec.dependencies || [],
                subtasks: [],
                timestamp: new Date().toISOString(),
                assignedTo: null,
                retryCount: 0,
                failedAgents: []
            };

            // Calculate predicted impact for subtasks
            subtask.predictedImpact = this.metaReflection.predictImpact(subtask);

            this.taskQueue.push(subtask);
            parentTask.subtasks.push(subtaskId);

            logger.info('SUBTASK_CREATED', `Subtask ${subtaskId} created for parent ${parentTaskId} (Impact: ${subtask.predictedImpact})`, {
                subtaskId,
                parentTaskId,
                dependencies: subtask.dependencies,
                domainLabel: subtask.domainLabel,
                predictedImpact: subtask.predictedImpact
            });
        }

        // Re-sort queue: Priority first, then Predicted Impact
        this.taskQueue.sort((a, b) => {
            const priorityDiff = (b.priority || 1) - (a.priority || 1);
            if (priorityDiff !== 0) return priorityDiff;
            return (b.predictedImpact || 0) - (a.predictedImpact || 0);
        });

        return parentTask.subtasks;
    }

    /**
     * Splits a task into smaller subtasks as a meta-reflection strategy.
     * @param {Object} task 
     */
    handleTaskSplitting(task) {
        logger.info('META_REFLECTION_STRATEGY', `Splitting task ${task.id} due to low success probability`, { taskId: task.id });

        const subtaskSpecs = [
            {
                description: `Subtask 1: Initial phase of ${task.description}`,
                domainLabel: task.domainLabel,
                complexityScore: Math.ceil(task.complexityScore / 2),
                priority: (task.priority || 1) + 1
            },
            {
                description: `Subtask 2: Conclusion of ${task.description}`,
                domainLabel: task.domainLabel,
                complexityScore: Math.floor(task.complexityScore / 2),
                priority: task.priority,
                dependencies: [] // Created dynamically below correctly? No, decomposeTask handles it
            }
        ];

        this.decomposeTask(task.id, subtaskSpecs);
    }

    /**
     * Flags a task for collaboration as a meta-reflection strategy.
     * @param {Object} task 
     */
    handleTaskCollaboration(task) {
        logger.info('META_REFLECTION_STRATEGY', `Tagging task ${task.id} for agent collaboration`, { taskId: task.id });
        task.isCollaborative = true;
        task.priority = Math.min((task.priority || 1) + 2, 10); // Increase priority for collaborative efforts

        // In this core, we signal collaboration by adding a metadata flag that the agent can read
        task.suggestedAction = 'USE_COLLABORATION_PROTOCOL';
    }

    /**
     * Handles task reassignment logic for low confidence or non-fatal issues
     * @param {Object} task 
     * @param {string} agentId 
     * @param {string} reason 
     */
    handleTaskReassignment(task, agentId, reason) {
        if (this.agents[agentId]) {
            this.agents[agentId].status = 'idle';
        }

        task.retryCount += 1;
        task.failedAgents = task.failedAgents || [];
        task.failedAgents.push(agentId);

        if (task.retryCount < 3) {
            task.status = 'pending';
            task.assignedTo = null;
            logger.info('TASK_REQUEUED', `Task ${task.id} returned to queue for next-best agent. Reason: ${reason}`);
        } else {
            task.status = 'failed';
            logger.error('TASK_ABORTED', `Task ${task.id} aborted after multiple reassignment attempts. Reason: ${reason}`);
        }
    }

    /**
     * Dispatches task to Agent API (Mocked Implementation)
     * @param {Object} agent 
     * @param {Object} task 
     * @returns {Promise<Object>} The structured output
     */
    async dispatchToAgent(agent, task) {
        return new Promise((resolve, reject) => {
            // Simulated network latency
            setTimeout(() => {
                // Random failure simulation for error handling testing
                if (Math.random() < 0.1) {
                    reject(new Error('Agent API Connection Timeout'));
                    return;
                }

                const startTime = Date.now();
                // Simulate processing...
                const endTime = Date.now();

                // Mocked "Actual" results
                resolve({
                    resultData: `Task "${task.description}" executed successfully.`,
                    confidenceScore: parseFloat((Math.random() * (0.99 - 0.7) + 0.7).toFixed(2)),
                    actualImpact: parseFloat((task.predictedImpact * (Math.random() * (1.2 - 0.8) + 0.8)).toFixed(1)),
                    executionTime: (endTime - startTime) + 150 // Mocked duration
                });
            }, 500);
        });
    }

    /**
     * Finds the most suitable agent for a task based on calculated compatibility scores.
     * @param {Object} task 
     * @param {string[]} excludeIds List of agent IDs to skip
     * @returns {string|null} Agent ID or null
     */
    findBestAgentForTask(task, excludeIds = []) {
        const availableAgents = Object.values(this.agents).filter(a =>
            a.status === 'idle' && !excludeIds.includes(a.id)
        );

        if (availableAgents.length === 0) return null;

        const scoredAgents = availableAgents.map(agent => ({
            id: agent.id,
            score: this.calculateCompatibility(agent, task)
        }));

        // Sort by score descending
        scoredAgents.sort((a, b) => b.score - a.score);

        const bestMatch = scoredAgents[0];

        // Threshold for minimum compatibility (optional, e.g., 0.2)
        if (bestMatch.score < 0.2) {
            logger.warn('LOW_COMPATIBILITY', `No agent found with sufficient compatibility for task ${task.id}`, {
                taskId: task.id,
                bestScore: bestMatch.score
            });
            return null;
        }

        return bestMatch.id;
    }

    /**
     * Calculates a compatibility score (0.0 to 1.0) between an agent and a task.
     * Considers domain, complexity, skill vectors, historical success, and priority.
     * @param {Object} agent 
     * @param {Object} task 
     * @returns {number} Normalized score
     */
    calculateCompatibility(agent, task) {
        let score = 0;

        // 1. Domain Match (40%)
        const domainMatch = agent.domainLabels.includes(task.domainLabel) ? 1.0 : 0.0;
        score += domainMatch * 0.4;

        // 2. Skill-to-Complexity Fit (30%)
        const skillValues = Object.values(agent.skillScores);
        const avgSkill = skillValues.reduce((a, b) => a + b, 0) / (skillValues.length || 1);
        const specificSkill = agent.skillScores[task.domainLabel] || (avgSkill * 0.7);

        const normalizedSkill = specificSkill / 10;
        const normalizedComplexity = task.complexityScore / 10;

        const skillScore = normalizedSkill >= normalizedComplexity ? 1.0 : (normalizedSkill / normalizedComplexity);
        score += skillScore * 0.3;

        // 3. Historical Success Rate (20%)
        const successRate = agent.performanceData.successRate || 0.5;
        score += successRate * 0.2;

        // 4. Priority & Reliability Buffer (10%)
        const experienceFactor = Math.min(agent.performanceData.tasksCompleted / 50, 1.0);
        const priorityWeight = (task.priority || 1) / 10;
        const reliabilityScore = (experienceFactor * 0.5) + (priorityWeight * 0.5);
        score += reliabilityScore * 0.1;

        return parseFloat(score.toFixed(4));
    }

    /**
     * Logs the final output in the "database"
     * @param {string} taskId 
     * @param {string} agentId 
     * @param {Object} output 
     */
    logOutput(taskId, agentId, output) {
        const timestamp = new Date().toISOString();
        const task = this.taskQueue.find(t => t.id === taskId);

        this.taskOutputs[taskId] = {
            taskId,
            agentId,
            timestamp,
            resultData: output.resultData,
            confidenceScore: output.confidenceScore,
            predictedImpact: task ? task.predictedImpact : 0,
            actualImpact: output.actualImpact || 0,
            executionTime: output.executionTime
        };

        if (task) {
            task.status = 'completed';
            if (this.agents[agentId]) {
                this.agents[agentId].status = 'idle';
                this.updateAgentPerformance(agentId, true, output.actualImpact || 0, task.domainLabel);
            }

            // If this was a subtask, notify the parent and check for aggregation
            if (task.parentTaskId) {
                this.checkAndAggregateParent(task.parentTaskId);
            }
        }

        logger.info('TASK_COMPLETED', `Task ${taskId} completed and logged`, {
            taskId,
            agentId,
            confidence: output.confidenceScore,
            isSubtask: !!task.parentTaskId,
            parentTaskId: task.parentTaskId || null
        });
    }

    /**
     * Internal protocol for agent communication during task execution.
     * Allows sharing results, requesting input, and synchronizing progress.
     * @param {string} taskId Task enacting the collaboration
     * @param {string} agentId Agent performing the action
     * @param {string} action 'SHARE_RESULT' | 'REQUEST_INPUT' | 'SYNC_PROGRESS'
     * @param {Object} payload Data for the collaboration
     */
    async collaborate(taskId, agentId, action, payload) {
        const task = this.taskQueue.find(t => t.id === taskId);
        if (!task) throw new Error(`Task ${taskId} not found`);

        const contextId = task.parentTaskId || taskId;

        if (!this.collaborationSpace[contextId]) {
            this.collaborationSpace[contextId] = {
                sharedResults: {},
                requests: [],
                syncPoints: {}
            };
        }

        const context = this.collaborationSpace[contextId];

        // Log the interaction
        this.collaborationLogs.push({
            timestamp: new Date().toISOString(),
            taskId,
            agentId,
            action,
            payload
        });

        logger.info('AGENT_COLLABORATION', `Agent ${agentId} initiated ${action} for task ${taskId}`, {
            action,
            taskId,
            contextId
        });

        switch (action) {
            case 'SHARE_RESULT':
                context.sharedResults[taskId] = {
                    agentId,
                    data: payload,
                    timestamp: new Date().toISOString()
                };
                break;

            case 'REQUEST_INPUT':
                context.requests.push({ from: agentId, taskId, payload, timestamp: new Date().toISOString() });
                // Conflict resolution: If multiple agents request same data, prioritize existing shared results
                if (payload.targetTaskId && context.sharedResults[payload.targetTaskId]) {
                    return context.sharedResults[payload.targetTaskId].data;
                }
                break;

            case 'SYNC_PROGRESS':
                // Update shared progress state
                context.syncPoints[taskId] = payload;
                break;

            default:
                logger.warn('UNKNOWN_COLLABORATION_ACTION', `Action ${action} is not supported`);
        }

        return null;
    }

    /**
     * Checks if all subtasks of a parent are completed and aggregates results.
     * @param {string} parentTaskId 
     */
    checkAndAggregateParent(parentTaskId) {
        const parentTask = this.taskQueue.find(t => t.id === parentTaskId);
        if (!parentTask || parentTask.status === 'completed') return;

        const subtasks = this.taskQueue.filter(t => t.parentTaskId === parentTaskId);
        const allCompleted = subtasks.length > 0 && subtasks.every(s => s.status === 'completed');

        if (allCompleted) {
            logger.info('SUBTASKS_COMPLETE', `All subtasks for parent ${parentTaskId} finished. Aggregating results.`, {
                parentTaskId,
                subtaskCount: subtasks.length
            });

            const subtaskResults = subtasks.map(s => this.taskOutputs[s.id]).filter(Boolean);
            const collabContext = this.collaborationSpace[parentTaskId];

            // Result Aggregation Logic
            let aggregatedData = subtaskResults.map(r => `[Agent ${r.agentId}]: ${r.resultData}`).join('\n---\n');

            // Include collaborative data in the final result
            if (collabContext && Object.keys(collabContext.sharedResults).length > 0) {
                aggregatedData += '\n\n=== Collaborative Contributions ===\n';
                for (const [taskId, res] of Object.entries(collabContext.sharedResults)) {
                    aggregatedData += `[Task ${taskId} by Agent ${res.agentId}]: ${JSON.stringify(res.data)}\n`;
                }
            }

            const aggregatedResult = {
                resultData: aggregatedData,
                confidenceScore: parseFloat((subtaskResults.reduce((acc, r) => acc + r.confidenceScore, 0) / subtaskResults.length).toFixed(2)),
                predictedImpact: parseFloat((subtaskResults.reduce((acc, r) => acc + (r.predictedImpact || 0), 0) / subtaskResults.length).toFixed(1)),
                actualImpact: parseFloat((subtaskResults.reduce((acc, r) => acc + (r.actualImpact || 0), 0) / subtaskResults.length).toFixed(1)),
                executionTime: subtaskResults.reduce((acc, r) => acc + (r.executionTime || 0), 0)
            };

            // Log the parent task as completed with aggregated data
            this.logOutput(parentTaskId, 'AGGREGATOR_SYSTEM', aggregatedResult);

            logger.info('PARENT_TASK_FINALIZED', `Aggregated results for complex task ${parentTaskId}`, {
                parentTaskId,
                aggregatedImpact: aggregatedResult.predictedImpact
            });
        }
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
            this.updateAgentPerformance(agentId, false, 0, task.domainLabel);
        }

        task.retryCount += 1;
        task.failedAgents = task.failedAgents || [];
        task.failedAgents.push(agentId);

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
    updateAgentPerformance(agentId, success, impact = 0, domain = null) {
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

        // Meta-Reflection Module update for domain-specific metrics
        if (domain) {
            this.metaReflection.updateAgentMetadata(agentId, domain, success, impact);
        }
    }
}

export default CoreEngine;
