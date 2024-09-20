const { executeSQLQuery } = require('../controllers/formController');

// Function to get all tables in the database
exports.getAllTables = async (req, res) => {
  try {
    const db_url = process.env.DB_URL;
    const db_auth_token = process.env.DB_AUTH_TOKEN;

    // SQL query to fetch all table names
    const sql = `SELECT name FROM sqlite_master WHERE type='table';`;
    
    const response = await executeSQLQuery(db_url, db_auth_token, sql);
    
    // Log the nested response to understand its structure
    console.log('Nested Response from executeSQLQuery:', response.results[0].response);

    // Accessing the table names correctly
    const tables = response.results[0].response.result.rows.map(row => row[0]); // Get the first item from each row
    console.log('Tables found:', tables); // Log the tables found

    res.render('categories', { tables });
  } catch (err) {
    console.error('Error fetching tables:', err);
    res.status(500).send('An error occurred while fetching tables.');
  }
};

  
  

exports.getTableData = async (req, res) => {
    const { tableName } = req.params;

    try {
        const db_url = process.env.DB_URL;
        const db_auth_token = process.env.DB_AUTH_TOKEN;

        const sql = `SELECT * FROM "${tableName}";`;
        const response = await executeSQLQuery(db_url, db_auth_token, sql);

        const rows = response.results[0].response.result.rows;
        const cols = response.results[0].response.result.cols;

        const columnNames = cols.map(col => col.name);

        const formattedData = rows.map(row => {
            const obj = {};
            columnNames.forEach((colName, index) => {
                obj[colName] = row[index].value; // Ensure we're accessing the value
            });
            return obj;
        });

        const frequencyData = {};
        columnNames.slice(3).forEach(colName => {
            frequencyData[colName] = 0; // Initialize frequency counts
        });

        formattedData.forEach(row => {
            columnNames.slice(3).forEach(colName => {
                frequencyData[colName] += row[colName] || 0; // Count frequency
            });
        });

        res.render('tableData', { tableName, data: formattedData, frequencyData });
    } catch (err) {
        console.error('Error fetching table data:', err);
        res.status(500).send('An error occurred while fetching table data.');
    }
};
