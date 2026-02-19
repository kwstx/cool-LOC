import { server, engine } from '../src/api/server.js';
import logger from '../src/logger/Logger.js';

const PORT = 3000;
const API_KEY = 'loc_secret_key_2026';
const BASE_URL = `http://localhost:${PORT}`;

async function runTests() {
    console.log('--- TEST_START ---');
    console.log('--- Starting API Exposure Tests ---');

    try {
        // 1. Test Health Check (Auth Required)
        console.log('\nTesting Health Check (No Auth)...');
        const healthNoAuth = await fetch(`${BASE_URL}/health`);
        console.log(`Status: ${healthNoAuth.status} (Expected: 401)`);

        console.log('\nTesting Health Check (With Auth)...');
        const healthRes = await fetch(`${BASE_URL}/health`, {
            headers: { 'x-api-key': API_KEY }
        });
        const healthData = await healthRes.json();
        console.log('Health Data:', healthData);

        // 2. Register an Agent
        console.log('\nRegistering Agent...');
        const agentData = {
            id: 'api_agent_1',
            domainLabels: ['research', 'analysis'],
            skillScores: { research: 9, analysis: 8 },
            apiEndpoint: 'http://mock-agent-1/api',
            performanceData: { tasksCompleted: 10, successRate: 0.9, averageImpact: 7.5 }
        };

        const regRes = await fetch(`${BASE_URL}/agents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
            body: JSON.stringify(agentData)
        });
        const regResult = await regRes.json();
        console.log('Agent Registration Result:', regResult);

        // 3. Submit a Task
        console.log('\nSubmitting Task...');
        const taskData = {
            description: 'Evaluate the impact of AI on specialized workforce',
            domainLabel: 'analysis',
            complexityScore: 6,
            priority: 2
        };

        const taskRes = await fetch(`${BASE_URL}/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
            body: JSON.stringify(taskData)
        });
        const taskResult = await taskRes.json();
        const taskId = taskResult.taskId;
        console.log('Task Submission Result:', taskResult);

        // 4. Poll for status
        console.log(`\nPolling for task ${taskId} status...`);
        let completed = false;
        for (let i = 0; i < 10; i++) {
            const statusRes = await fetch(`${BASE_URL}/tasks/${taskId}`, {
                headers: { 'x-api-key': API_KEY }
            });
            const statusData = await statusRes.json();
            console.log(`Poll ${i + 1}: Status = ${statusData.status}`);

            if (statusData.status === 'completed') {
                completed = true;
                break;
            }
            await new Promise(r => setTimeout(r, 1000));
        }

        if (!completed) {
            console.error('Task did not complete in time');
        } else {
            // 5. Retrieve Output
            console.log('\nRetrieving Output...');
            const outputRes = await fetch(`${BASE_URL}/outputs/${taskId}`, {
                headers: { 'x-api-key': API_KEY }
            });
            const outputData = await outputRes.json();
            console.log('Output Data:', outputData);
        }

        // 6. Query all tasks
        console.log('\nQuerying All Tasks...');
        const tasksRes = await fetch(`${BASE_URL}/tasks`, {
            headers: { 'x-api-key': API_KEY }
        });
        const tasksData = await tasksRes.json();
        console.log(`Total Tasks in Workflow: ${tasksData.length}`);
        console.table(tasksData);

        console.log('\n--- API Exposure Tests Completed Successfully ---');

    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        // Cleanup
        server.close();
        engine.stopExecutionLoop();
    }
}

runTests();
