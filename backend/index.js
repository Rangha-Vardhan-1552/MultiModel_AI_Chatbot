import express from 'express';
import axios from 'axios';
import { HfInference } from '@huggingface/inference';
import multer from 'multer';
import fs from 'fs-extra';
import path from 'path';
import cors from 'cors';
import ffmpeg from 'fluent-ffmpeg';
import axiosRetry from 'axios-retry';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3001;
app.use(cors());
app.use(express.json()); // Middleware to parse JSON bodies

const HF_TOKEN = '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';
const OPEN_API = '';
const inference = new HfInference(HF_TOKEN);

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage: storage });

// Configure axios retry with exponential backoff strategy
axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

// Endpoint for image captioning
app.post('/image-caption', upload.single('image'), async (req, res) => {
  const imagePath = req.file.path;

  try {
    const imageBlob = fs.readFileSync(imagePath);
    const response = await inference.imageToText({
      data: imageBlob,
      model: 'Salesforce/blip-image-captioning-base',
    });

    // Clean up the uploaded file
    fs.unlinkSync(imagePath);

    res.json(response);
  } catch (error) {
    console.error('Error processing image:', error);
    res.status(500).send(error.message);
  }
});

// Endpoint for video processing
app.post('/process-video', upload.single('video'), async (req, res) => {
  const filePath = req.file.path;

  try {
    const videoAnalysisResult = await analyzeVideo(filePath);
    const description = await generateDescription(videoAnalysisResult);
    res.json({ description });
  } catch (error) {
    console.error('Error processing video:', error);
    res.status(500).send(error.message);
  } finally {
    // Clean up uploaded file
    fs.removeSync(filePath);
  }
});

// Function to extract frames from video using ffmpeg
async function extractFrames(filePath) {
  const framesDir = path.join(__dirname, 'frames');
  fs.emptyDirSync(framesDir); // Ensure the directory is empty

  return new Promise((resolve, reject) => {
    ffmpeg(filePath)
      .on('end', () => resolve(framesDir))
      .on('error', (error) => reject(`Error extracting frames: ${error.message}`))
      .save(`${framesDir}/frame-%03d.png`);
  });
}

// Function to analyze video frames
async function analyzeVideo(filePath) {
  try {
    const framesDir = await extractFrames(filePath);
    const frames = fs.readdirSync(framesDir).filter((file) => file.endsWith('.png'));
    let analysisResult = '';

    for (const frame of frames) {
      const image = fs.readFileSync(path.join(framesDir, frame));
      const base64Image = image.toString('base64');
      const result = await analyzeFrame(base64Image);
      analysisResult += `Frame ${frame}: ${result}\n`;
    }

    // Clean up frames directory
    fs.emptyDirSync(framesDir);

    return analysisResult;
  } catch (error) {
    console.error('Error analyzing video frames:', error);
    throw error;
  }
}

// Function to analyze a single frame using Hugging Face API
async function analyzeFrame(base64Image) {
  try {
    const response = await retryAsync(async () => {
      return await axios.post(
        'https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-base',
        { inputs: base64Image },
        {
          headers: {
            Authorization: `Bearer ${HF_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );
    }, 5);

    if (response.data && response.data.error) {
      throw new Error(response.data.error);
    }

    console.log('Response Status:', response.status);
    console.log('Response Data:', response.data);

    return response.data;
  } catch (error) {
    console.error('Error analyzing frame:', error);
    throw error;
  }
}

// Helper function to handle retries
async function retryAsync(fn, maxAttempts) {
  let attempts = 0;
  while (attempts < maxAttempts) {
    try {
      return await fn();
    } catch (error) {
      if (
        error.response &&
        (error.response.status === 503 ||
          (error.response.data && error.response.data.error.includes('loading')))
      ) {
        console.log('Retrying due to service unavailability or model loading...');
        const delay = Math.min(30000, 2 ** attempts * 1000) + Math.random() * 1000; // Exponential backoff with jitter
        await new Promise((resolve) => setTimeout(resolve, delay)); // Wait before retrying
        attempts++;
      } else {
        throw error;
      }
    }
  }
  throw new Error('Max retry attempts reached');
}

// Function to generate description based on video analysis result
async function generateDescription(analysisResult) {
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'text-davinci-002', // Adjusted to a valid OpenAI model
        messages: [
          {
            role: 'user',
            content: analysisResult,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${OPEN_API}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.data || !Array.isArray(response.data.choices) || response.data.choices.length === 0) {
      throw new Error('Unexpected response structure from OpenAI API');
    }

    const description = response.data.choices[0].message.content.trim();

    console.log('OpenAI API Response:', description);

    return description;
  } catch (error) {
    console.error('Error generating description:', error);
    throw error;
  }
}

// Endpoint for uploading data
app.post('/upload', upload.single('file'), (req, res) => {
  const filePath = path.join(__dirname, req.file.path);
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      res.status(500).json({ error: 'Failed to read the file' });
      return;
    }
    req.app.locals.data = data;
    res.status(200).json({ message: 'File uploaded successfully' });
  });
});

// Endpoint for asking questions
app.post('/ask', async (req, res) => {
  const question = req.body.question;
  const context = req.app.locals.data;

  if (!context) {
    res.status(400).json({ error: 'No data uploaded' });
    return;
  }

  try {
    const response = await retryAsync(async () => {
      return await axios.post(
        'https://api-inference.huggingface.co/models/distilbert/distilbert-base-uncased-distilled-squad',
        {
          inputs: {
            question: question,
            context: context,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${HF_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );
    }, 5);

    const answer = response.data.answer;
    res.status(200).json({ answer: answer });
  } catch (error) {
    console.error('Error fetching answer:', error);
    res.status(500).json({ error: 'Failed to get answer from the model' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
