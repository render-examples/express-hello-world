// const express = require("express");
// const path = require('path');
// const fs = require('fs');
// const app = express();
// const port = process.env.PORT || 3001;
// const https = require("https");
// const htmlParser = require("node-html-parser");
// const FlexSearch = require("flexsearch");
// const bodyParser = require("body-parser");
//
// app.use(express.static("public"));
// app .use(bodyParser.urlencoded({ extended: false })); // parse application/x-www-form-urlencoded
// app.use(bodyParser.json()); // parse application/json
//
// const index = new FlexSearch.Index({
//     preset: "memory",
//     tokenize: "forward",
//     resolution: 5
// });
//
//
// fs.readdir("views/content", (err, files) => {
//     if (err) {
//         console.error(err);
//     } else {
//         files.forEach(file => {
//             const id = file.slice(0, -5); // remove the .html extension
//             const filePath = path.join(__dirname, `views/content/${file}`);
//             fs.readFile(filePath, { encoding: "utf-8" }, (err, data) => {
//                 if (err) {
//                     console.error(err);
//                     return;
//                 }
//
//                 const content = htmlParser.parse(data).innerText.trim();
//
//                 if(!index.contain(id)){
//                     index.add(id, content);
//                 }
//
//             });
//         });
//     }
// });
// const sendHtml = (req, res, filePath) => {
//     fs.readFile(filePath, { encoding: "utf-8" }, (err, data) => {
//         if (err) {
//             console.error(err);
//             const filePath = path.join(__dirname, `views/error/not-found.html`);
//             sendHtml(req, res, filePath);
//         } else {
//             res.type("html").send(data);
//         }
//     });
// }
// const searchResultDialog = (resultsHtml) => {
//     return `
//         <dialog open id="search-results-dialog">
//             <div id="search-results-content">
//                 <a id="search-results-close-button">x</a>
//                 <h5>Search Results</h5>
//                 <div style="display: flex; flex-direction: column; gap: 0.5rem;">
//                     ${resultsHtml}
//                 </div>
//             </div>
//         </dialog>
//         <script>
//             try {
//                 const myDialog = document.getElementById('search-results-dialog');
//                 const closeButton = document.getElementById('search-results-close-button');
//                 document.addEventListener('click', () => myDialog.close());
//                 closeButton.addEventListener('click', () => myDialog.close());
//                 myDialog.addEventListener('click', (event) => event.stopPropagation());
//             }
//             catch (e) {
//               // Do nothing
//             }
//         </script>
//         <style>
//             #search-results-dialog {
//                 border: none; background-color: white;
//                 margin-left: 8vw; margin-top: 0.7rem; padding: 0;
//                 z-index: 100;
//             }
//             #search-results-dialog #search-results-content {
//                 overflow-y: scroll;
//                 scrollbar-gutter: unset;
//                 display: flex;
//                 flex-direction: column;
//                 flex-wrap: nowrap;
//                 border: 1px solid gray; box-shadow: 0.8rem 0.4rem 0.4rem gray;
//                 min-width: 17rem; max-width: 22rem; max-height: 20rem; padding: 1rem 1rem 2rem 1rem;
//                 background-color: white;
//             }
//             #search-results-close-button {
//                 padding: 0.1rem 0.5rem; margin-bottom: 1rem;
//                 border: 1px solid red;
//                 display: inline-block;
//                 align-self: flex-end;
//             }
//         </style>
//         `
// }
// app.post("/search", (req, res) => {
//     const query = req.body.search;
//
//     if (typeof query !== "string") {
//         res.send("No results");
//         return;
//     }
//
//     const results = index.search(query, ['content']);
//
//     if (results.length === 0) {
//         const noResultsHtml = searchResultDialog("No results");
//         res.send(noResultsHtml);
//         return;
//     }
//
//     let resultsHtml = "";
//
//     results.forEach((resultId, index) => {
//         const filePath = path.join(__dirname, `views/content/${resultId}.html`);
//
//         fs.readFile(filePath, { encoding: "utf-8" }, (err, data) => {
//             if (err) {
//                 console.error(err);
//                 return;
//             }
//
//             const content = htmlParser
//                 .parse(data)
//                 .querySelector('.section-e b')
//                 .innerText
//                 .replace("openings=\"http://thehandyforce.com/windows/\" title =\"Window installer in Toronto\">", "");
//
//             resultsHtml += `<a style="display: inline-block;" hx-post="/content/${resultId}">${content}</a>`;
//
//             if(index === results.length - 1) {
//                 resultsHtml = searchResultDialog(resultsHtml);
//                 res.send(resultsHtml);
//             }
//         });
//     });
// });
//
// app.get('/api', (req, res) => {
//     res.setHeader('Content-Type', 'text/html');
//     res.setHeader('Cache-Control', 's-max-age=1, stale-while-revalidate');
//     res.end(`Hello!`);
// });
//
// app.get("/scrape", (req, res) => {
//     let allowScrape = false;
//     if (allowScrape === false) return;
//     for (let i = 1000; i < 2269; i++) {
//         const fileName = `${i}.html`;
//         const url = "https://www.buildingcode.online/" + fileName;
//
//         https.get(url, res => {
//             let data = [];
//             const headerDate = res.headers && res.headers.date ? res.headers.date : 'no response date';
//             console.log(headerDate)
//
//                 res.on('data', chunk => {
//                     data.push(chunk);
//                 });
//
//                 res.on('end', () => {
//                     const contentHtml = htmlParser
//                         .parse(Buffer.concat(data).toString())
//                         .querySelector(".content").outerHTML;
//
//                     fs.writeFileSync(`views/content/${fileName}`, contentHtml);
//
//                     console.log('Response ended: ', contentHtml);
//                 });
//             }).on('error', err => {
//                 console.log('Error: ', err.message);
//             });
//         }
//
//
//     res.type("html").send("<div>SCRAPING BRO</div>");
//     }
// );
// app.get("/*", (req, res) => {
//         const filePath = path.join(__dirname, `public/index.html`);
//         res.sendFile(filePath);
//     }
// );
//
// app.post("/sections/:id", (req, res) => {
//         const id = req.params.id;
//         const filePath = path.join(__dirname, `views/sections/${id}.html`);
//         sendHtml(req, res, filePath);
//     }
// );
//
// app.post("/content/:id",
//     (req, res) => {
//         const id = req.params.id;
//         const filePath = path.join(__dirname, `views/content/${id}.html`);
//         sendHtml(req, res, filePath);
//     }
// );
// const server = app.listen(port, () => console.log(`Example app listening on port ${port}!`));
//
// server.keepAliveTimeout = 120 * 1000;
// server.headersTimeout = 120 * 1000;
