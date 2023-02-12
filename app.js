const express = require("express");
const app = express();
const port = process.env.PORT || 3001;

app.get("/", (req, res) => res.type('html').send(html));

app.listen(port, () => console.log(`Example app listening on port ${port}!`));

app.get('/hello', (req, res) => {
  res.send('Hello World!')
})

// or respond with html
app.get('/big', (req, res) => {
  res.send('<h1>Hello World!</h1>')
})

// or respond with JSON
app.get('/json', (req, res) => {
  res.send('{"name" : "ArT"}')
})

// :name indicates a parameter at this location in the URI
app.get('/greeting/:id', (req, res) => {
  res.send(`Hello! The id provided was ${req.params.id}.`)
})

// combine your skills and get creative
app.get('/yo/:buddy', (req, res) => {
  res.send(`<h1>Yo, ${req.params.buddy}!</h1>`)
})

// provide multiple query parameters (named first and last) with ? and &
app.get('/fancy', (req, res) => {
  const first = req.query.first
  const last = req.query.last
  res.send(`Hello ${first} ${last}!`)
})
const html = `
<!DOCTYPE html>
<html>

<head>
    <title>CyberV</title>
    <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.5.1/dist/confetti.browser.min.js"></script>
    <script>
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
        @import url("https://p.typekit.net/p.css?s=1&k=vnd5zic&ht=tk&f=39475.39476.39477.39478.39479.39480.39481.39482&a=18673890&app=typekit&e=css");

        @font-face {
            font-family: "neo-sans";
            src: url("https://use.typekit.net/af/00ac0a/00000000000000003b9b2033/27/l?primer=7cdcb44be4a7db8877ffa5c0007b8dd865b3bbc383831fe2ea177f62257a9191&fvd=n7&v=3") format("woff2"), url("https://use.typekit.net/af/00ac0a/00000000000000003b9b2033/27/d?primer=7cdcb44be4a7db8877ffa5c0007b8dd865b3bbc383831fe2ea177f62257a9191&fvd=n7&v=3") format("woff"), url("https://use.typekit.net/af/00ac0a/00000000000000003b9b2033/27/a?primer=7cdcb44be4a7db8877ffa5c0007b8dd865b3bbc383831fe2ea177f62257a9191&fvd=n7&v=3") format("opentype");
            font-style: normal;
            font-weight: 700;
        }

        html {
            font-family: neo-sans;
            font-weight: 700;
            font-size: calc(62rem / 16);
        }

        body {
            background: white;
        }

        section,
        span {
            border-radius: 1em;
            padding: 1em;
            position: absolute;
            top: 50%;
            left: 50%;
            margin-right: -50%;
            transform: translate(-50%, -50%);
        }

        span {
            color:darkturquoise;
            font-size: 30%;
            top: 60%;
        }

        footer {
            width: 100%;
            height: 28px;
            position: absolute;
            bottom: 0px;
            left: 0px;
            text-align: center;
            font-size: 20%;
            position: absolute;
        }
    </style>
</head>

<body>
    <section>
        Welcome to our webapp!
    </section>
    <span>If you see this page then you have successfully bypassed the WAF/or developed are foolish to disable
        it.</span>
    <footer>
        This is part of capsone project demonstration, from Group 17: WAF;
    </footer>
</body>

</html>
`
