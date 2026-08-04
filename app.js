const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.all('/', async (req, res) => {
    // קבלת הפרמטרים מימות המשיח
    const body = { ...req.query, ...req.body };
    
    // בדיקה ראשונית שהשרת פעיל
    if (!body.ApiPhone) {
        return res.send("OK");
    }

    // החזרת תשובה קולית בפורמט של ימות המשיח
    res.send("id_list_message=t-השרת מחובר בהצלחה");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
