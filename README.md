# Generative AI Agents Developer Contest by NVIDIA and LangChain

The project was started to prepare a submission to the contest.
Initially I planned to come up with new algorithms related to Visual Large Language Models.
Then I refocused on creating a web application around a Retrieval-Augmented Generation (RAG) 
Pipeline with NVIDIA AI LangChain AI Endpoints as inspired by https://developer.nvidia.com/blog/tips-for-building-a-rag-pipeline-with-nvidia-ai-langchain-ai-endpoints

The project is supposed to let a Physical Therapist (PT) submit an image and ask PT related questions.
The Web Service would reuse a group of medical online sources to augment the questions and prepare better 
answers.

Unfortunately, my Web programming experience was not very extensive. I had to learn to use ReactJS for 
the front-end and NodeJS, ExpressJS for the back-end server. Currently the system is far from implementing
what was planned. But it's alive at https://nvidia-contest-react-app.onrender.com/

See the companion Create React App project at https://github.com/sdarkhovsky/nvidia-contest-react-app


This is the [Express](https://expressjs.com) [Hello world](https://expressjs.com/en/starter/hello-world.html) example on [Render](https://render.com).

The app in this repo is deployed at [https://express.onrender.com](https://express.onrender.com).

## Deployment

See https://render.com/docs/deploy-node-express-app or follow the steps below:

Create a new web service with the following values:
  * Build Command: `yarn`
  * Start Command: `node app.js`

That's it! Your web service will be live on your Render URL as soon as the build finishes.
