// Helper function to generate the CREATE TABLE query
const generateCreateTableQuery = (category, items) => {
    return `
      CREATE TABLE IF NOT EXISTS "${category}" (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        Prompt TEXT,
        Creator TEXT,
        ${items.map(item => `"${item}" INTEGER DEFAULT 0`).join(', ')}
      );
    `.trim();
  };
  
  // Helper function to generate the INSERT query
  const generateInsertQuery = (prompt, creator, category, items) => {
    return `
      INSERT INTO "${category}" (Prompt, Creator${items.length > 0 ? `, ${items.map(item => `"${item}"`).join(', ')}` : ''})
      VALUES ("${prompt}", "${creator}", ${items.map(() => '0').join(', ')});
    `.trim();
  };
  
  // Helper function to execute SQL queries
  const executeSQLQuery = async (db_url, db_auth_token, sql, params = []) => {
    const response = await fetch(db_url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${db_auth_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [{ type: 'execute', stmt: { sql, params } }],
      }),
    });
    return response.json();
  };
  
  // Main form submission handler
  exports.submitForm = async (req, res) => {
    try {
      const { category, prompt, creator, items = [] } = req.body;
  
      const db_url = process.env.DB_URL;
      const db_auth_token = process.env.DB_AUTH_TOKEN;
  
      // Generate the CREATE TABLE query
      const createTableQuery = generateCreateTableQuery(category, items);
  
      // Execute the CREATE TABLE query
      const createTableResponse = await executeSQLQuery(db_url, db_auth_token, createTableQuery);
  
      // Check for errors in the table creation response
      if (createTableResponse.results && createTableResponse.results.some(result => result.type === 'error')) {
        throw new Error('Error creating table.');
      }
  
      // Generate the INSERT query
      const insertDataQuery = generateInsertQuery(prompt, creator, category, items);
  
      // Prepare params for insertion
      const params = [prompt, creator, ...items.map(() => 0)];
  
      // Execute the INSERT query
      const insertDataResponse = await executeSQLQuery(db_url, db_auth_token, insertDataQuery, params);
  
      // Check for errors in the insertion response
      if (insertDataResponse.results && insertDataResponse.results.some(result => result.type === 'error')) {
        throw new Error('Error inserting data.');
      }
      
      res.send('Table created and data inserted successfully!');
    } catch (err) {
      console.error('Error:', err);
      res.status(500).send('An error occurred.');
    }
  };
  
  // Export the executeSQLQuery function
  module.exports.executeSQLQuery = executeSQLQuery;
  