const express = require("express");
const app = express();
const port = process.env.PORT || 3001;
const cors = require('cors');
const { WebcastPushConnection } = require('tiktok-live-connector');

app.use(cors({
    origin: 'http://localhost:4200',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
}));

app.get("/sse", (req, res) => {



    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    // Envoyez des données au client chaque seconde (exemple)
    const interval = setInterval(() => {
        const eventData = `data: ${JSON.stringify({ message: `Message from server at ${new Date().toLocaleTimeString()}` })}\n\n`;
        // res.write(eventData);
    }, 1000);




    // Username of someone who is currently live
    // let tiktokUsername = "wilsonn__glenn";
    let tiktokUsername = "mymydia7";
    // let tiktokUsername = "arianeandrew";
    // let tiktokUsername = "blacktigerbxl";
    // let tiktokUsername = "ambrochette_asb";
    // let tiktokUsername = "ninkogmari";
    // Create a new wrapper object and pass the username
    let tiktokLiveConnection = new WebcastPushConnection(tiktokUsername);

    tiktokLiveConnection.connect().then(state => {
        console.info(`Connected to roomId ${state.roomId}`);
        const eventData = `data: ${JSON.stringify({ type: 'connected', data: `Gift: connected to room` })}\n\n`;
        res.write(eventData);
         
        // Store the response object for the current HTTP client
        // connectedWebSocketClients.add(res);
    }).catch(err => {
        console.error('Failed to connect', err);
        // res.status(500).send('Failed to connect to TikTok Live');
    })
    
    // Define the events that you want to handle
    // In this case, we listen to chat messages (comments)
    tiktokLiveConnection.on('chat', data => {
        console.log(`${data.uniqueId} (userId:${data.userId}) writes: ${data.comment}`);
        const eventData = `data: ${JSON.stringify({ type: 'chat', user: data.uniqueId, message: data.comment })}\n\n`;
        // res.write(eventData);
        // Send the comment to all connected WebSocket clients
        // res.write(JSON.stringify({ type: 'chat', data: data.comment }));
    })
    
    // And here we receive gifts sent to the streamer
    tiktokLiveConnection.on('gift', data => {
        if (data.giftType === 1 && !data.repeatEnd) {
            // Streak in progress => show only temporary
            console.log(`${data.uniqueId} is sending gift ${data.giftName} x${data.repeatCount}`);
        } else {
            // Streak ended or non-streakable gift => process the gift with final repeat_count
            console.log(`${data.uniqueId} has sent gift ${data.giftName} x${data.repeatCount}`);
            // Send the gift information to all connected WebSocket clients
            const eventData = `data: ${JSON.stringify({ type: 'gift', id: data.giftId, user: data.uniqueId, giftName: data.giftName, repeatCount: data.repeatCount, giftType: data.giftType })}\n\n`;
            res.write(eventData);
        }
    })






    // Fermez la connexion lorsque le client se déconnecte
    req.on("close", () => {
        clearInterval(interval);
    });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
