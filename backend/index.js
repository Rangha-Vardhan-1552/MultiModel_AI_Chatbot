// Import necessary modules
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
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { videoProcessing } from './controllers/videoController.js';
import { ImageToText } from './controllers/ImageController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3001;
app.use(cors());
app.use(express.json());

// const HF_TOKEN = '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';
const HF_TOKEN = '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 '
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
app.post('/image-caption', upload.single('image'), ImageToText);

// Endpoint for video processing
app.post('/process-video', upload.single('video'), videoProcessing);

// Function to extract text from file (handles PDF, DOCX, and plain text)
async function extractTextFromFile(filePath, fileType) {
  return new Promise((resolve, reject) => {
    if (fileType === 'application/pdf') {
      const dataBuffer = fs.readFileSync(filePath);
      pdfParse(dataBuffer)
        .then(data => resolve(data.text))
        .catch(err => reject(err));
    } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') { // DOCX file
      mammoth.extractRawText({ path: filePath })
        .then(result => resolve(result.value))
        .catch(err => reject(err));
    } else if (fileType === 'text/plain') { // Plain text file
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    } else {
      reject(new Error('Unsupported file type'));
    }
  });
}

// Endpoint for listing uploaded files
app.get('/files', (req, res) => {
  const uploadedFiles = req.app.locals.uploadedFiles || [];
  res.status(200).json({ files: uploadedFiles });
});

// Endpoint for removing an uploaded file
app.delete('/files/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'uploads', filename);

  try {
    fs.removeSync(filePath);
    req.app.locals.uploadedFiles = req.app.locals.uploadedFiles.filter(file => file !== filename);
    res.status(200).json({ message: 'File removed successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove the file' });
  }
});

// Endpoint for uploading multiple files
app.post('/upload', upload.array('files'), async (req, res) => {
  const filePaths = req.files.map(file => path.join(__dirname, file.path));
  const fileTypes = req.files.map(file => file.mimetype);
  const fileNames = req.files.map(file => file.filename);

  try {
    const texts = await Promise.all(filePaths.map((filePath, index) => extractTextFromFile(filePath, fileTypes[index])));

    // Add labels to each segment
    const labeledTexts = texts.map((text, index) => `File: ${fileNames[index]}\n\n${text}`);

    // Concatenate labeled texts with some separator or marker between files
    const concatenatedText = labeledTexts.join('\n\n=== FILE BREAK ===\n\n');

    // Accumulate the new content with the existing context
    req.app.locals.data = (req.app.locals.data || '') + '\n\n' + concatenatedText;
    req.app.locals.uploadedFiles = (req.app.locals.uploadedFiles || []).concat(fileNames);

    res.status(200).json({ message: 'Files uploaded successfully', files: fileNames });
  } catch (err) {
    console.error('Error uploading files:', err);
    res.status(500).json({ error: 'Failed to read the files' });
  }
});

// Function to summarize text in chunks
async function summarizeText(text) {
  const chunkSize = 2000; // Define a reasonable chunk size for the summarization model
  const chunks = [];

  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.substring(i, i + chunkSize));
  }

  try {
    const summarizedChunks = await Promise.all(chunks.map(async (chunk) => {
      const response = await axios.post(
        'https://api-inference.huggingface.co/models/facebook/bart-large-cnn',
        {
          inputs: chunk,
          parameters: {
            max_length: 200, // Set the maximum length for each chunk's summary
            min_length: 50,  // Set the minimum length for each chunk's summary
            do_sample: true, // Enable sampling for more diverse summaries
            top_k: 50,       // Limit the sampling pool to the top 50 logits
            top_p: 0.95,     // Use nucleus sampling with cumulative probability of 0.95
          }
        },
        {
          headers: {
            Authorization: `Bearer ${HF_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.data || !response.data[0].summary_text) {
        throw new Error('Unexpected response structure from Hugging Face API');
      }

      return response.data[0].summary_text;
    }));

    return summarizedChunks.join(' ');

  } catch (error) {
    console.error('Error summarizing text:', error.response ? error.response.data : error.message);
    throw new Error('Failed to summarize text');
  }
}

// Endpoint for asking questions
app.post('/ask', async (req, res) => {
  const question = req.body.question;
  const context = req.app.locals.data;

  if (!context) {
    res.status(400).json({ error: 'No data uploaded' });
    return;
  }

  try {
    // Summarize the context before passing it to the QA model
    const summarizedContext = await summarizeText(context);
    console.log(summarizedContext)

    const response = await axios.post(
      'https://api-inference.huggingface.co/models/distilbert/distilbert-base-uncased-distilled-squad',
      {
        inputs: {
          question: question,
          context: summarizedContext,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('QA Response:', response.data);

    if (!response.data || !response.data.answer) {
      throw new Error('Unexpected response structure from Hugging Face API');
    }

    const answer = response.data.answer;
    res.status(200).json({ answer: answer });
  } catch (error) {
    console.error('Error fetching answer:', error.response ? error.response.data : error.message);
    res.status(500).json({ answer: 'Failed to get answer from the model' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
