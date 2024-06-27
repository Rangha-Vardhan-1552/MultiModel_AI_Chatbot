
import { HfInference } from '@huggingface/inference';
import multer from 'multer';
import axiosRetry from 'axios-retry';
import axios from 'axios';
import fs from 'fs-extra';

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

export const ImageToText=async (req, res) => {
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
  };
  