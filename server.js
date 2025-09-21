const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static('public'));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- Caching setup for currency rates ---
let currencyCache = {
    rates: null,
    lastFetched: 0,
};
const CACHE_DURATION = 4 * 60 * 60 * 1000; // Cache for 4 hours

const destinationToCurrency = {
    'USA': 'USD', 'United States': 'USD', 'New York': 'USD', 'Los Angeles': 'USD', 'Canada': 'CAD', 'Toronto': 'CAD', 'Mexico': 'MXN', 'France': 'EUR', 'Paris': 'EUR', 'Germany': 'EUR', 'Berlin': 'EUR', 'Italy': 'EUR', 'Rome': 'EUR', 'Spain': 'EUR', 'Madrid': 'EUR', 'UK': 'GBP', 'United Kingdom': 'GBP', 'London': 'GBP', 'Switzerland': 'CHF', 'Russia': 'RUB', 'India': 'INR', 'Delhi': 'INR', 'Mumbai': 'INR', 'Goa': 'INR', 'Japan': 'JPY', 'Tokyo': 'JPY', 'China': 'CNY', 'Singapore': 'SGD', 'UAE': 'AED', 'Dubai': 'AED', 'Saudi Arabia': 'SAR', 'Brazil': 'BRL', 'South Africa': 'ZAR', 'Australia': 'AUD', 'New Zealand': 'NZD',
};

const currencySymbols = {
    "USD": "$", "EUR": "€", "JPY": "¥", "GBP": "£", "INR": "₹", "AUD": "A$", "CAD": "C$", "CHF": "CHF", "CNY": "¥", "SEK": "kr", "NZD": "NZ$", "MXN": "Mex$", "SGD": "S$", "HKD": "HK$", "NOK": "kr", "KRW": "₩", "TRY": "₺", "RUB": "₽", "BRL": "R$", "ZAR": "R", "AED": "د.إ", "SAR": "﷼"
};

// --- Using more stable, key-less currency API ---
async function getLiveRates() {
    const now = Date.now();
    if (currencyCache.rates && (now - currencyCache.lastFetched < CACHE_DURATION)) {
        console.log("INFO: Using cached currency rates.");
        return currencyCache.rates;
    }
    try {
        console.log("INFO: Fetching live currency rates from reliable key-less API...");
        const response = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json');
        if (!response.ok) {
            throw new Error(`Failed to fetch rates: ${response.status}`);
        }
        const data = await response.json();
        
        currencyCache.rates = data.usd; 
        currencyCache.rates['usd'] = 1; // Ensure base rate is present
        currencyCache.lastFetched = now;
        console.log("SUCCESS: Live currency data received.");
        return currencyCache.rates;
    } catch (error) {
        console.error("ERROR: The getLiveRates function failed.", error.message);
        return { 'usd': 1.0, 'inr': 83.5, 'eur': 0.92, 'jpy': 157.0, 'gbp': 0.78, 'aud': 1.5, 'cad': 1.37 };
    }
}


function getDestinationCurrency(destination) {
    const keys = Object.keys(destinationToCurrency);
    const foundKey = keys.find(key => destination.toLowerCase().includes(key.toLowerCase()));
    return foundKey ? destinationToCurrency[foundKey] : 'USD';
}

async function convertCurrency(amount, fromCurrency, toCurrency) {
    const rates = await getLiveRates();
    const fromRate = rates[fromCurrency.toLowerCase()] || 1;
    const toRate = rates[toCurrency.toLowerCase()] || 1;
    const amountInUSD = amount / fromRate;
    return amountInUSD * toRate;
}

function parseJsonResponse(rawText) {
    console.log("--- RAW AI RESPONSE ---");
    console.log(rawText);
    console.log("--- END RAW AI RESPONSE ---");
    try {
        const startIndex = rawText.indexOf('{');
        const endIndex = rawText.lastIndexOf('}');
        if (startIndex === -1 || endIndex === -1) {
            throw new Error("No valid JSON object found in AI response.");
        }
        const jsonString = rawText.substring(startIndex, endIndex + 1);
        return JSON.parse(jsonString);
    } catch (e) {
        console.error("Failed to parse JSON even after cleaning. Raw text was:", rawText);
        throw new Error(`Invalid JSON from AI: ${e.message}`);
    }
}

async function generateContentWithRetry(model, requestPayload) {
    const maxRetries = 3;
    let delay = 2000;
    for (let i = 0; i < maxRetries; i++) {
        try {
            const result = await model.generateContent(requestPayload);
            return result;
        } catch (error) {
            if (error.status === 503 || error.status === 429) {
                console.warn(`WARN: Model is busy or rate limit hit (Status: ${error.status}). Retrying...`);
                if (i < maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                    delay *= 2;
                } else {
                    throw error;
                }
            } else {
                throw error;
            }
        }
    }
}

app.post('/generate', async (req, res) => {
    try {
        const { destination, budget, currency, days, people, interests, language } = req.body;
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
        const currentDate = new Date().toLocaleDateString('en-CA');

        const destinationCurrency = getDestinationCurrency(destination);
        const convertedBudget = await convertCurrency(parseFloat(budget), currency, destinationCurrency);
        console.log("\n--- New Itinerary Request ---");
        console.log(`User Budget: ${budget} ${currency} | Converted to: ${convertedBudget.toFixed(2)} ${destinationCurrency}`);

        console.log("\n--- STEP 1: Kicking off Research Call ---");
        const researchPrompt = `
            You are a data-gathering assistant. Your only job is to use Google Search to find real, bookable options for a trip.
            **CRITICAL**: Search for current prices as of today, "${currentDate}". Find specific, real items.
            The user wants to travel to: "${destination}" for ${people} people. Their interests are: "${interests}".
            Find the following and provide your output in a single, valid JSON object:
            1. Three accommodation options (budget, mid-range, luxury) with their real name and actual price per night in ${destinationCurrency} for ${people} people.
            2. Five activities matching the user's interests with their real name and actual ticket price per person in ${destinationCurrency}.
            3. Three dining options (cheap, mid-range, fine dining) with the real name and an estimated meal cost per person in ${destinationCurrency}.
            The JSON structure MUST be:
            { "accommodations": [ { "name": "...", "type": "...", "pricePerNight": ... } ], "activities": [ { "name": "...", "pricePerPerson": ... } ], "dining": [ { "name": "...", "type": "...", "estimatedMealPrice": ... } ] }`;
        
        const researchResult = await generateContentWithRetry(model, {
            contents: [{ role: 'user', parts: [{ text: researchPrompt }] }],
            tools: [{ "google_search": {} }],
        });
        const researchData = parseJsonResponse(researchResult.response.text());
        console.log("SUCCESS: Research data compiled:", JSON.stringify(researchData, null, 2));

        if (!researchData.accommodations || researchData.accommodations.length === 0 || !researchData.activities || researchData.activities.length === 0) {
            throw new Error("The AI failed to gather complete research data. Please try your request again with slightly different interests.");
        }

        console.log("\n--- STEP 2: Kicking off Assembly Call ---");
        const assemblyPrompt = `
            You are a precise travel planner. Your task is to create a day-by-day itinerary using ONLY the items from the provided JSON data, performing exact calculations.
            **CRITICAL**: The entire response MUST be in the language: "${language}".
            **User Constraints:**
            - Destination: ${destination}, Duration: ${days} days, Travelers: ${people}
            - Strict Budget: ${convertedBudget.toFixed(2)} ${destinationCurrency}
            
            **REAL-WORLD DATA (Use ONLY these items):**
            ${JSON.stringify(researchData)}

            **Instructions for Calculation and Assembly:**
            1. Select ONE accommodation from the list that best fits the budget.
            2. Create a ${days}-day itinerary using a mix of the provided activities and dining options.
            3. **CRITICAL CALCULATION LOGIC**:
                - The "estimatedCost" for each activity/meal MUST be (price from data * ${people}).
                - The "dailyTotalCost" for each day MUST be the sum of all costs for that day for the entire group.
                - The "totalEstimatedCost" MUST be the mathematical sum of (accommodation "pricePerNight" * ${days}) + (all other activity/meal costs for the whole group).
            4. **MANDATORY FIELDS**: Your final JSON MUST include 'estimatedCostPerNight' in 'accommodationSuggestion' and 'dailyTotalCost' for each day.
            5. Ensure the final "totalEstimatedCost" does NOT exceed the Strict Budget.
            6. Your response MUST be a single, valid JSON object.
            The JSON structure must be:
            { "tripTitle": "...", "summary": "...", "totalEstimatedCost": ..., "currencyInfo": { "code": "${destinationCurrency}" }, "accommodationSuggestion": { "type": "...", "name": "...", "estimatedCostPerNight": ... }, "itinerary": [ { "day": 1, "theme": "...", "dailyTotalCost": ..., "activities": [ { "time": "...", "activity": "...", "description": "...", "estimatedCost": ... } ] } ] }`;
        
        const assemblyResult = await generateContentWithRetry(model, {
             contents: [{ role: 'user', parts: [{ text: assemblyPrompt }] }]
        });
        const finalItineraryJson = parseJsonResponse(assemblyResult.response.text());
        
        console.log(`SUCCESS: Final itinerary assembled. AI Cost: ${finalItineraryJson.totalEstimatedCost} ${destinationCurrency}`);
        const correctSymbol = currencySymbols[destinationCurrency] || '$';
        finalItineraryJson.currencyInfo.symbol = correctSymbol;
        
        res.json(finalItineraryJson);
    } catch (error) {
        console.error('Error in the generation process:', error);
        res.status(500).json({ error: error.message || 'Failed to generate itinerary.' });
    }
});

app.post('/generate-blog', async (req, res) => {
    try {
        const { itineraryData, tone, language } = req.body;
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
        const prompt = `
            You are a creative travel blogger. Based on the following trip itinerary data, write an engaging blog post.
            The tone MUST be: "${tone}". The language MUST be: "${language}".
            Do not respond in JSON. Write a complete blog post with a title, introduction, body, and conclusion.
            Itinerary Data:
            ${JSON.stringify(itineraryData, null, 2)}`;
        const result = await generateContentWithRetry(model, {
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
        });
        res.json({ blogPost: result.response.text() });
    } catch (error) {
        console.error('Error generating blog post:', error);
        res.status(500).json({ error: 'Failed to generate blog post.' });
    }
});

app.post('/generate-social', async (req, res) => {
    try {
        const { itineraryData, language } = req.body;
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
        const prompt = `
            You are a social media manager. Based on the following trip itinerary, create 3 distinct social media post suggestions.
            For each suggestion, provide a creative caption and 3-5 relevant hashtags.
            The entire response MUST be in the language: "${language}".
            Do not respond in JSON. Use clear headings for each post suggestion.
            Itinerary Data:
            ${JSON.stringify(itineraryData, null, 2)}`;
        const result = await generateContentWithRetry(model, {
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
        });
        res.json({ socialContent: result.response.text() });
    } catch (error) {
        console.error('Error generating social media content:', error);
        res.status(500).json({ error: 'Failed to generate social media content.' });
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});

