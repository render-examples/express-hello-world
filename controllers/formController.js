exports.submitForm = (req, res) => {
    const category = req.body.category;
    const prompt = req.body.prompt;
    const creator = req.body.creator;
    const items = req.body.items || []; // Get items from the body

    console.log("category", category);
    console.log("prompt", prompt);
    console.log("creator", creator);
    console.log("ITEMS", items);

    const db_url = process.env.DB_URL;
    const db_auth_token = process.env.DB_AUTH_TOKEN;

    // Create the table with item columns
    const createTableQuery = `
    CREATE TABLE IF NOT EXISTS "${category}" (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prompt TEXT,
      creator TEXT,
      ${items.map(item => `"${item}" INTEGER DEFAULT 0`).join(', ')}
    );
    `.trim();

    // Debugging: log the create table query
    console.log('Create Table Query:', createTableQuery);

    // Execute create table query
    fetch(db_url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${db_auth_token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            requests: [
                { type: 'execute', stmt: { sql: createTableQuery } },
            ],
        }),
    })
    .then((response) => response.json())
    .then((data) => {
        console.log('Database Response:', data);

        // Check for errors in the response
        if (data.results) {
            data.results.forEach((result, index) => {
                if (result.type === 'error') {
                    console.error(`Error in create table request ${index + 1}:`, result.error);
                }
            });
        }

        // Now insert the data
        const insertDataQuery = `
        INSERT INTO "${category}" (prompt, creator${items.length > 0 ? `, ${items.map(item => `"${item}"`).join(', ')}` : ''})
        VALUES ("${prompt}", "${creator}", ${items.map(() => '0').join(', ')});
        `.trim();

        console.log('Insert Data Query:', insertDataQuery);

        // Prepare params for insertion
        const params = [prompt, creator, ...items.map(() => 0)];

        // Execute insert data query
        return fetch(db_url, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${db_auth_token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                requests: [
                    { type: 'execute', stmt: { sql: insertDataQuery, params } },
                ],
            }),
        });
    })
    .then((response) => response.json())
    .then((data) => {
        console.log('Database Response for Insert:', data);

        // Check for errors in the response
        if (data.results) {
            data.results.forEach((result, index) => {
                if (result.type === 'error') {
                    console.error(`Error in insert request ${index + 1}:`, result.error);
                }
            });
        }

        res.send('Table created and data inserted successfully!');
    })
    .catch((err) => {
        console.error('Fetch Error:', err);
        res.status(500).send('An error occurred.');
    });
};
