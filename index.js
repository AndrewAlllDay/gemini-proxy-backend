// gemini-proxy-backend/index.js

// Load environment variables from .env file
require('dotenv').config();

// Import necessary packages
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { format } = require('date-fns'); // Need date-fns for formatting dates

// Initialize Express application
const app = express();

// --- Configuration for Cloud Functions ---
// Cloud Functions uses a specific port provided by the environment
const PORT = process.env.PORT || 8080; // Default to 8080 for local testing if PORT not set by Cloud Functions

// --- Middleware ---
// Enable CORS for specified origins
// IMPORTANT: Your Netlify domain and local dev port 5175 have been added here.
app.use(cors({
    origin: [
        'http://localhost:5175', // Your React app's local dev URL
        'https://aquamarine-fox-f08f2d.netlify.app' // Your deployed frontend domain
        // Add other frontend domains if needed (e.g., test environments)
    ]
}));
// Parse JSON request bodies
app.use(express.json());

// --- Gemini API Key (Securely loaded from environment variables) ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
    console.error('ERROR: GEMINI_API_KEY is not defined in environment variables. Please check your .env file or Cloud Function configuration.');
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// --- API Endpoint for Gemini Insights ---
// This is the endpoint your React frontend will call
app.post('/api/gemini-insight', async (req, res) => {
    // Now expecting 'scores' array within each round object as well
    const { prompt, rounds } = req.body;

    if (!prompt || !Array.isArray(rounds)) {
        console.error('Validation Error: Missing or invalid "prompt" or "rounds" in request body.');
        return res.status(400).json({ error: "Missing 'prompt' or 'rounds' data in request body." });
    }

    try {
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 250, // Increased slightly to allow for more detailed hole-by-hole analysis
            },
            systemInstruction: "You are a concise disc golf score analyst. Provide direct, brief answers to questions about scores and hole-by-hole performance. Avoid unnecessary conversational filler, intros, or lengthy explanations unless explicitly asked for. When listing, use bullet points or a clear, simple format. Prioritize factual data from the provided scores.",
        });

        // Reconstruct the prompt text from your frontend logic, adapted for backend
        let promptText = "Analyze the following disc golf scores and provide insights based on overall and hole-by-hole performance. ";
        const lowerCasePrompt = prompt.toLowerCase();

        if (lowerCasePrompt.includes("best round")) {
            promptText += "Identify the single best round by total score (lowest number). Tell me ONLY its Course Name, Layout Name, Date (formatted as MMMM d, yyyy), Total Score, and all individual Hole Scores. Do not add any other text, prefaces, or conversational filler. E.g., 'Course: Maple Hill, Layout: Red, Date: January 1, 2023, Score: 55 (Holes: 3, 4, 3, 5...)'. ";
        } else if (lowerCasePrompt.includes("worst round")) {
            promptText += "Identify the single worst round by total score (highest number). Tell me ONLY its Course Name, Layout Name, Date (formatted as MMMM d, yyyy), Total Score, and all individual Hole Scores. Do not add any other text, prefaces, or conversational filler. E.g., 'Course: Oakwood, Layout: Blue, Date: February 15, 2023, Score: 72 (Holes: 4, 5, 4, 6...)'. ";
        } else if (lowerCasePrompt.includes("average score")) {
            promptText += "Calculate the average total score across all rounds. Provide ONLY the number. E.g., '62'. ";
        } else if (lowerCasePrompt.includes("most common course")) {
            promptText += "Identify the most frequently played course. Provide ONLY the course name. E.g., 'Pleasant Valley'. ";
        } else if (lowerCasePrompt.includes("hole scores") || lowerCasePrompt.includes("hole by hole")) {
            promptText += "List the individual hole scores for each round. For each round, include Course Name, Layout Name, Date, and then a list of all Hole Scores. ";
        }
        else if (lowerCasePrompt.includes("summarize") || lowerCasePrompt.includes("summary")) {
            promptText += "Provide a brief, 2-3 sentence summary of the overall trends or highlights in these scores, mentioning consistent good/bad holes if relevant. ";
        } else {
            promptText += "Answer the user's question directly and concisely. Ensure the response is no more than 3 sentences and can include hole-by-hole observations. "; // Default concise instruction
        }

        if (rounds.length === 0) {
            promptText += "No scores available to analyze.";
        } else {
            promptText += "Here are the scores:\n";
            const sortedRounds = [...rounds].sort((a, b) => {
                const scoreA = a.totalScore || Infinity;
                const scoreB = b.totalScore || Infinity;
                return scoreA - scoreB;
            });

            sortedRounds.forEach((round, index) => {
                let roundDate = null;
                if (round.date && typeof round.date === 'object' && round.date.seconds) {
                    roundDate = new Date(round.date.seconds * 1000 + round.date.nanoseconds / 1000000);
                }
                const formattedDate = roundDate ? format(roundDate, 'MMMM d, yyyy') : 'N/A Date';
                const holeScores = round.scores && Array.isArray(round.scores) ? ` (Holes: ${round.scores.join(', ')})` : '';

                promptText += `Round ${index + 1}: Course: ${round.courseName || 'N/A'}, Layout: ${round.layoutName || 'N/A'}, Date: ${formattedDate}, Total Score: ${round.totalScore || 'N/A'}, Score to Par: ${round.scoreToPar || 0}${holeScores}\n`;
            });
            promptText += `\nUser's specific question: "${prompt}".`;
        }

        const result = await model.generateContent(promptText);
        const text = result.response.text();
        res.json({ response: text });

    } catch (error) {
        console.error('Gemini API request failed:', error);
        res.status(500).json({ error: 'Failed to get insights from Gemini AI. Please try again later.' });
    }
});

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Backend server listening at http://localhost:${PORT}`);
        console.log(`Test with: curl -X POST -H "Content-Type: application/json" -d '{"prompt": "hello", "rounds": []}' http://localhost:${PORT}/api/gemini-insight`);
    });
}

exports.app = app;