import express from 'express';
import rateLimit from 'express-rate-limit';
import CoreEngine from '../engine/CoreEngine.js';
import logger from '../logger/Logger.js';

const app = express();
const port = process.env.PORT || 3000;
const API_KEY = process.env.LOC_API_KEY || 'loc_secret_key_2026';

const engine = new CoreEngine();
engine.startExecutionLoop(1000); // Start the engine loop

app.use(express.json());

// Authentication Middleware
const authenticate = (req, res, next) => {
    const key = req.headers['x-api-key'];
    if (!key || key !== API_KEY) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or missing API Key' });
    }
    next();
};

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per 15 minutes
    message: { error: 'Too many requests, please try again later.' }
});

app.use(limiter);
app.use(authenticate);

// --- Endpoints ---

/**
 * @api {post} /tasks Task Submission
 */
app.post('/tasks', (req, res) => {
    try {
        const taskId = engine.submitTask(req.body);
        res.status(201).json({ taskId, message: 'Task submitted successfully' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * @api {post} /agents Agent Registration
 */
app.post('/agents', (req, res) => {
    try {
        const agentId = engine.registerAgent(req.body);
        res.status(201).json({ agentId, message: 'Agent registered successfully' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * @api {get} /tasks Workflow Querying (All tasks)
 */
app.get('/tasks', (req, res) => {
    const { status, domainLabel } = req.query;
    let filteredTasks = engine.taskQueue;

    if (status) {
        filteredTasks = filteredTasks.filter(t => t.status === status);
    }
    if (domainLabel) {
        filteredTasks = filteredTasks.filter(t => t.domainLabel === domainLabel);
    }

    res.json(filteredTasks.map(t => ({
        id: t.id,
        description: t.description,
        status: t.status,
        domainLabel: t.domainLabel,
        assignedTo: t.assignedTo,
        predictedImpact: t.predictedImpact,
        progress: t.subtasks.length > 0
            ? `${t.subtasks.filter(sid => engine.taskOutputs[sid]).length}/${t.subtasks.length}`
            : (t.status === 'completed' ? '1/1' : '0/1')
    })));
});

/**
 * @api {get} /tasks/:id Detailed Task/Workflow Querying
 */
app.get('/tasks/:id', (req, res) => {
    const task = engine.taskQueue.find(t => t.id === req.params.id);
    if (!task) {
        return res.status(404).json({ error: 'Task not found' });
    }

    // Include results if available
    const output = engine.taskOutputs[req.params.id];

    res.json({
        ...task,
        output: output || null
    });
});

/**
 * @api {get} /outputs/:taskId Output Retrieval
 */
app.get('/outputs/:taskId', (req, res) => {
    const output = engine.taskOutputs[req.params.taskId];
    if (!output) {
        return res.status(404).json({ error: 'Output not found for this task' });
    }
    res.json(output);
});

/**
 * @api {get} /health Health Check & Summary
 */
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        engineActive: !!engine.executionTimer,
        agentCount: Object.keys(engine.agents).length,
        queueSize: engine.taskQueue.length,
        timestamp: new Date().toISOString()
    });
});

const server = app.listen(port, () => {
    logger.info('API_SERVER_STARTED', `LOC API Server running on port ${port}`);
});

export { app, server, engine };
