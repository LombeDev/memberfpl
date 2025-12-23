const fetch = require('node-fetch');

exports.handler = async (event) => {
    const path = event.queryStringParameters.path;
    const url = `https://fantasy.premierleague.com/api/${path}/`;

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'application/json'
            }
        });

        if (!response.ok) throw new Error(`FPL API responded with ${response.status}`);

        const data = await response.json();

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body: JSON.stringify(data)
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Could not fetch FPL data", details: error.message })
        };
    }
};
