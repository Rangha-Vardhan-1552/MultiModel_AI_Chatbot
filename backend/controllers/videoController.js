
import fs from 'fs-extra';
import axios from 'axios';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import { fileURLToPath } from 'url';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const HF_TOKEN = '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';
const OPEN_API = '';

export const videoProcessing= async (req, res) => {
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
  };
  
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
  
      return JSON.stringify(response.data); // Convert the object to a string
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
          model: 'gpt-4', // Use GPT-4 for better results
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
  