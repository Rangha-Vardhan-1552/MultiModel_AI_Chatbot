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

const HF_TOKEN = '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';

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

// Endpoint for asking questions
app.post('/ask', async (req, res) => {
  const question = req.body.question;
  const context = req.app.locals.data;
  console.log(context)

  if (!context) {
    res.status(400).json({ error: 'No data uploaded' });
    return;
  }

  try {
    const response = await axios.post(
      'https://api-inference.huggingface.co/models/deepset/bert-large-uncased-whole-word-masking-squad2',
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

    if (!response.data || !response.data.answer) {
      throw new Error('Unexpected response structure from Hugging Face API');
    }

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
