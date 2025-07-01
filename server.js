const express = require("express");
const admin = require("firebase-admin");
const bodyParser = require("body-parser");
const rateLimit = require("express-rate-limit");
const auth = require("basic-auth");
const app = express();

// ====================== CONFIGURATION ======================
const SERVICE_ACCOUNT = require("./.data/firebase.json");
// ====== Config from .env ======
const BASIC_AUTH_USER = process.env.BASIC_AUTH_USER;
const BASIC_AUTH_PASS = process.env.BASIC_AUTH_PASS;

const FIREBASE_DB_URL = process.env.FIREBASE_URL;

// ====================== SECURITY MIDDLEWARES ======================
// Rate limiting: 1 request per 10 minutes
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 20,
  message: "Too many requests. Please wait 10 minutes.",
});

// ====================== FIREBASE INIT ======================
admin.initializeApp({
  credential: admin.credential.cert(SERVICE_ACCOUNT),
  databaseURL: FIREBASE_DB_URL,
});
const db = admin.database();

// ====================== DATA VALIDATION ======================
const convertMoistureToPercentae = (rawMoisture) => {
  try {
    let moisture = parseInt(rawMoisture);
    const maxValue = 1300; // Dry soil
    const minValue = 150; // wet soil
    
    // ensure values are within valid range
    moisture = Math.min(moisture, maxValue);
    moisture = Math.max(minValue, moisture);
    
    const percentage = 100 * (maxValue - moisture) / (maxValue - minValue);
    
    // Round to 0 decimal
    return Math.round(percentage);
  } catch (error) {
    throw new Error("Invalid moisture value");
  }
}

const validateData = (data) => {
  if (
    typeof data.temp !== "number" ||
    typeof data.humidity !== "number" ||
    typeof data.moisture !== "number"
  ) {
    throw new Error("Invalid data format");
  }
  return {
    temp: parseFloat(data.temp.toFixed(1)), // Round to 1 decimal
    humidity: parseFloat(data.humidity.toFixed(1)),
    moisture: convertMoistureToPercentae(data.moisture), // Convert to percentage
    sync: false, // Default sync flag
  };
};

// ====================== HELPER FUNCTIONS ======================
const generateTimestampKeys = () => {
    const now = new Date();
    // Format date as "YYYY-MM-DD" (Greek local time)
    const dateKey = now.toLocaleDateString("en-GB", {
        timeZone: "Europe/Athens", // Use Europe/Athens timezone
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).split("/").reverse().join("-"); // Converts "DD/MM/YYYY" -> "YYYY-MM-DD"

    // Format time as "HH:MM:SS" (Greek local time)
    const timeKey = now.toLocaleTimeString("en-GB", {
        timeZone: "Europe/Athens", // Use Europe/Athens timezone
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });
    return { dateKey, timeKey };
}

// ====================== THRESHOLD CHECKING & NOTIFICATIONS ======================
const checkThresholdsAndNotify = async (sensorData) => {
  try {
    // Get user settings with thresholds
    const userSettingsSnapshot = await db.ref('/userSettings').once('value');
    const userSettings = userSettingsSnapshot.val();
    
    if (!userSettings) {
      console.log("No user settings found.");
      return;
    }
    
    console.log("User settings retrieved:", userSettings);
    
    // Check if notifications are enabled
    if (!userSettings.notificationsEnabled) {
      console.log("Notifications are disabled.");
      return;
    }
    
    // Initialize array to store threshold violation messages
    const violations = [];
    
    // Check temperature thresholds
    if (sensorData.temp > userSettings.maxTempThreshold) {
      // violations.push(`High temperature alert: ${sensorData.temp}°C exceeds maximum threshold of ${userSettings.maxTempThreshold}°C`);
      violations.push(`High temperature alert: ${sensorData.temp}°C`);
    }
    if (sensorData.temp < userSettings.minTempThreshold) {
      // violations.push(`Low temperature alert: ${sensorData.temp}°C is below minimum threshold of ${userSettings.minTempThreshold}°C`);
      violations.push(`Low temperature alert: ${sensorData.temp}°C`);
    }
    
    // Check humidity thresholds
    if (sensorData.humidity > userSettings.maxHumidityThreshold) {
      // violations.push(`High humidity alert: ${sensorData.humidity}% exceeds maximum threshold of ${userSettings.maxHumidityThreshold}%`);
        violations.push(`High humidity alert: ${sensorData.humidity}%`);
    }
    if (sensorData.humidity < userSettings.minHumidityThreshold) {
      // violations.push(`Low humidity alert: ${sensorData.humidity}% is below minimum threshold of ${userSettings.minHumidityThreshold}%`);
      violations.push(`Low humidity alert: ${sensorData.humidity}%`);
    }
    
    // Check moisture thresholds
    if (sensorData.moisture > userSettings.maxMoistureThreshold) {
      violations.push(`High moisture alert: ${sensorData.moisture}`);
      // violations.push(`High moisture alert: ${sensorData.moisture} exceeds maximum threshold of ${userSettings.maxMoistureThreshold}`);
    }
    if (sensorData.moisture < userSettings.minMoistureThreshold) {
      violations.push(`Low moisture alert: ${sensorData.moisture}`);
      // violations.push(`Low moisture alert: ${sensorData.moisture} is below minimum threshold of ${userSettings.minMoistureThreshold}`);
    }
    
    // If there are any violations, send notification
    if (violations.length > 0) {
      await sendPushNotification(violations);
    }
  } catch (error) {
    console.error("Error checking thresholds:", error);
  }
};

// Function to send push notification using Firebase Cloud Messaging
const sendPushNotification = async (messages) => {
  try {
    // Get FCM token from user settings
    const tokenSnapshot = await db.ref('/userSettings/fcmToken').once('value');
    const fcmToken = tokenSnapshot.val();
    
    if (!fcmToken) {
      console.error("No FCM token found. Cannot send notification.");
      return;
    }
    
    // Create notification content
    const notification = {
      title: 'Greenhouse ALERT!',
      body: messages.join('\n').substring(0, 100) + (messages.join('\n').length > 100 ? '...' : '')
    };
    
    // Create message payload
    const message = {
      notification: notification,
      data: {
        detailedMessage: JSON.stringify(messages),
        timestamp: new Date().toISOString()
      },
      token: fcmToken
    };
    
    // Send the notification
    const response = await admin.messaging().send(message);
    console.log('Notification sent successfully:', response);
    
    // Log the notification event in Firebase
    const { dateKey, timeKey } = generateTimestampKeys();
    await db.ref(`/notifications/${dateKey}/${timeKey}`).set({
      messages: messages,
      timestamp: admin.database.ServerValue.TIMESTAMP
    });
    
  } catch (error) {
    console.error('Error sending notification:', error);
  }
};

// ====================== ROUTES ======================
app.use(bodyParser.json());

app.get("/post-data", limiter, async(req, res) => {
  try {
    console.log("Incoming GET request from IP:", req.ip);
    console.log("Request Query Params:", req.query);

    // 1. Extract and PARSE data from req.query (query params are strings)
    const queryData = {
      temp: parseFloat(req.query.temp),
      humidity: parseFloat(req.query.humidity),
      moisture: parseInt(req.query.moisture),
    };

    // 2. Validate and clean parsed data
    const payload = validateData(queryData); // Pass the parsed numbers to validation

    // 3. Generate timestamp keys
    const { dateKey, timeKey } = generateTimestampKeys();

    // 4. Save to Firebase
    await db.ref(`/sensorData/${dateKey}/${timeKey}`).set(payload);
    console.log(`Data saved to Firebase: /sensorData/${dateKey}/${timeKey}`);
    
    // 5. Check thresholds and send notification if needed
    await checkThresholdsAndNotify(payload);
    
    res.status(200).send("Data saved successfully via GET!");
  } catch (error) {
    console.error("ERROR processing GET request:", error.message);
    // Check if error is due to missing params before general "Bad Request"
    if (!req.query.temp || !req.query.humidity || !req.query.moisture) {
      res.status(400).send("Bad Request: Missing query parameters (temp, humidity, moisture)");
    } else {
      res.status(400).send(`Bad Request: ${error.message}`);
    }
  }
});


// ====================== SERVER START ======================
app.listen(3000, () => {
  console.log("Secure server running on port 3000");
  console.log("Current server time:", new Date().toLocaleString("el-GR", { timeZone: "Europe/Athens" }));
});
