import express from "express"
import fetch from "node-fetch";
import { HfInference } from "@huggingface/inference";
import multer from 'multer'
import fs from 'fs'
import path from 'path'
import cors from 'cors'

const app = express();
const port = 3001;
app.use(cors())

const HF_TOKEN = "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";
const inference = new HfInference(HF_TOKEN);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

app.post('/image-caption', upload.single('image'), async (req, res) => {
  try {
    const imagePath = req.file.path;
    const imageBlob = fs.readFileSync(imagePath);

    const response = await inference.imageToText({
      data: imageBlob,
      model: 'Salesforce/blip-image-captioning-base'
    });

    fs.unlinkSync(imagePath); // Clean up the uploaded file

    res.json(response);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});