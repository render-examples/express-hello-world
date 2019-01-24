# README

This is the [Express](https://expressjs.com) [Hello world](https://expressjs.com/en/starter/hello-world.html) example on [Render](https://render.com).

The app in this repo is deployed at [https://express.onrender.com](https://express.onrender.com).

## Deployment

Create a new web service with the following values:
  * Build Command: `yarn`
  * Start Command: `node app.js`

That's it! Your web service will be live on your Render URL as soon as the build finishes.

## Node versions
By default, Render uses the latest LTS version of Node.

It can also automatically detects and install the version of Node specified in the [engines](https://docs.npmjs.com/files/package.json#engines) directive in `package.json`. This can be an exact version like `10.11.0` or a range like `>=10.11 <10.12`.

This is the relevant snippet from `package.json` in this repo:
```json
  "engines": {
    "node": ">=10 <11"
  }
```
