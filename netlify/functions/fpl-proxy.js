const https = require('https');

exports.handler = async (event) => {
    // Define the headers to solve the CORS block
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Content-Type": "application/json"
    };

    // Handle the browser's security check (Preflight)
    if (event.httpMethod === "OPTIONS") {
        return { statusCode: 204, headers: corsHeaders, body: '' };
    }

    const path = event.queryStringParameters.path;
    const url = `https://fantasy.premierleague.com/api/${path}/`;

    return new Promise((resolve) => {
        const options = {
            headers: {
                // This 'User-Agent' is the secret to getting past FPL security
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36'
            }
        };

        https.get(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                resolve({
                    statusCode: 200,
                    headers: corsHeaders,
                    body: data
                });
            });
        }).on('error', (e) => {
            resolve({ 
                statusCode: 500, 
                headers: corsHeaders, 
                body: JSON.stringify({ error: e.message }) 
            });
        });
    });
};
