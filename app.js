const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const app = express();
const port = process.env.PORT || 3001;

// API Endpoint to Fetch Trades from Capitol Trades
const URL = "https://www.capitoltrades.com/trades?txDate=365d";

async function fetchTrades() {
    try {
        const response = await axios.get(URL, {
            headers: {
                "User-Agent": "Mozilla/5.0"
            }
        });

        const html = response.data;
        const $ = cheerio.load(html);
        const trades = [];

        $(".trade-item").each((index, element) => {
            const legislator = $(element).find(".legislator-name").text().trim();
            const ticker = $(element).find(".ticker-symbol").text().trim();
            const transaction = $(element).find(".transaction-type").text().trim();
            const date = $(element).find(".trade-date").text().trim();
            const amount = $(element).find(".amount").text().trim();

            if (legislator && ticker && transaction && date && amount) {
                trades.push({
                    legislator,
                    ticker,
                    transaction,
                    date,
                    amount,
                });
            }
        });

        return trades;
    } catch (error) {
        console.error("Error fetching trade data:", error);
        return [];
    }
}

// API Route for Trade Data (Searchable)
app.get("/trades", async (req, res) => {
    const { legislator, ticker, transaction } = req.query;
    let trades = await fetchTrades();

    // Filter Results Based on Query Params
    if (legislator) {
        trades = trades.filter(trade => trade.legislator.toLowerCase().includes(legislator.toLowerCase()));
    }
    if (ticker) {
        trades = trades.filter(trade => trade.ticker.toLowerCase() === ticker.toLowerCase());
    }
    if (transaction) {
        trades = trades.filter(trade => trade.transaction.toLowerCase() === transaction.toLowerCase());
    }

    res.json({ total: trades.length, trades });
});

// Serve Frontend HTML with Search Integration
app.get("/", (req, res) => {
    res.type("html").send(html);
});

const server = app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
server.keepAliveTimeout = 120 * 1000;
server.headersTimeout = 120 * 1000;

// Frontend HTML with Search Functionality
const html = `
<!DOCTYPE html>
<html>
  <head>
    <title>Congress Trades Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.5.1/dist/confetti.browser.min.js"></script>
    <script>
      function fetchTrades() {
        const legislator = document.getElementById("legislator").value;
        const ticker = document.getElementById("ticker").value;
        const transaction = document.getElementById("transaction").value;
        
        let query = "?";
        if (legislator) query += "legislator=" + encodeURIComponent(legislator) + "&";
        if (ticker) query += "ticker=" + encodeURIComponent(ticker) + "&";
        if (transaction) query += "transaction=" + encodeURIComponent(transaction) + "&";
        
        fetch("/trades" + query)
          .then(response => response.json())
          .then(data => {
            const resultsDiv = document.getElementById("results");
            resultsDiv.innerHTML = "";
            data.trades.forEach(trade => {
              const tradeElement = document.createElement("div");
              tradeElement.classList.add("trade-item");
              tradeElement.innerHTML = \`
                <strong>\${trade.legislator}</strong> - 
                <span style="color: blue;">\${trade.ticker}</span> - 
                <em>\${trade.transaction}</em> - 
                <span>\${trade.date}</span> - 
                <span style="color: green;">\${trade.amount}</span>
              \`;
              resultsDiv.appendChild(tradeElement);
            });
          });
      }
      
      setTimeout(() => {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          disableForReducedMotion: true
        });
      }, 500);
    </script>
    <style>
      body {
        font-family: Arial, sans-serif;
        background: white;
        text-align: center;
        padding: 20px;
      }
      h1 {
        color: #333;
      }
      input, button {
        margin: 5px;
        padding: 10px;
        font-size: 16px;
      }
      .trade-item {
        background: #f8f9fa;
        padding: 10px;
        margin: 5px;
        border-radius: 5px;
        box-shadow: 2px 2px 5px rgba(0, 0, 0, 0.1);
      }
    </style>
  </head>
  <body>
    <h1>Congress Trades Dashboard</h1>
    
    <div>
      <input type="text" id="legislator" placeholder="Search by Legislator">
      <input type="text" id="ticker" placeholder="Search by Ticker">
      <input type="text" id="transaction" placeholder="Buy/Sell">
      <button onclick="fetchTrades()">Search</button>
    </div>

    <div id="results">
      <p>Enter a search term and click "Search" to see results.</p>
    </div>
  </body>
</html>
`;
