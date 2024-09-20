// const fetch = require('node-fetch');

export function submitForm(req, res) {
  const name = req.body.fname;
  const db_url = process.env.DB_URL;
  const db_auth_token = process.env.DB_AUTH_TOKEN;

  console.log('DB URL:', db_url);
  console.log('Name:', name);

  const query = "drop table movies;";  // Example query

  fetch(db_url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${db_auth_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        { type: 'execute', stmt: { sql: query } },
        { type: 'close' }
      ],
    }),
  })
    .then((res) => res.json())
    .then((data) => {
      console.log('Database Response:', data);
      res.send(`Full name is: ${req.body.fname} ${req.body.lname}.`);
    })
    .catch((err) => {
      console.log('Error:', err);
      res.status(500).send('An error occurred.');
    });
}
