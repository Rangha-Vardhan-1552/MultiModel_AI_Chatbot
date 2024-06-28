import React, { useState, useRef } from 'react';
import axios from 'axios';
import Webcam from 'react-webcam';
import FileUpload from './components/FileUpload';
import AskQuestion from './components/AskQuestion';

function App() {
  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);
  const [remPara, setRemPara] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const webcamRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [transcription, setTranscription] = useState('');

  const [uploadMessage, setUploadMessage] = useState('');
  const [answer, setAnswer] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [resp, setResp] =useState('')

  const inputHandler = (event) => {
    setCameraOpen(false);
    setRemPara(true);
    setFile(event.target.files[0]);
  };

  const captureHandler = async () => {
    const imageSrc = await webcamRef.current.getScreenshot();
    const blob = dataURLtoFile(imageSrc, 'captured_image.png');
    console.log(blob);
    setRemPara(true);
    setFile(blob);
    setCameraOpen(false);
  };

  const handleCamera = () => {
    setRemPara(false);
    setCaption(''); // Clear the previous caption
    setCameraOpen(true);
  };

  const submitHandler = async (event) => {
    event.preventDefault();
    setRemPara(true);
    setLoading(true);
    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await axios.post('http://localhost:3001/image-caption', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      setRemPara(false);
      setLoading(false);
      setCaption(response.data.generated_text);
    } catch (error) {
      console.error('Error uploading the file', error);
      setLoading(false);
    }
  };

  const dataURLtoFile = (dataurl, filename) => {
    let arr = dataurl.split(','),
      mime = arr[0].match(/:(.*?);/)[1],
      bstr = atob(arr[1]),
      n = bstr.length,
      u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  // Handle video uploading
  const videoHandler = (event) => {
    setSelectedFile(event.target.files[0]);
  };

  const videoSubmitHandler = async (event) => {
    event.preventDefault();
    if (!selectedFile) {
      alert('Please select a file first!');
      return;
    }

    const formData = new FormData();
    formData.append('video', selectedFile);

    try {
      const response = await axios.post('http://localhost:3001/process-video', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      console.log(response.data.text);
      setTranscription(response.data.text);
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Error uploading file');
    }
  };

  // Handle successful file upload
  const handleUploadSuccess = (message, uploadedFileNames) => {
    setUploadMessage(message);
    setUploadedFiles(uploadedFileNames || []); // Ensure uploadedFileNames is an array
  };

  // Handle receiving an answer
  const handleAnswer = (answer) => {
    setAnswer(answer);
    setResp(answer)
    console.log('Answer received:', answer);
  };

  return (
    <>
      <div className="flex justify-center text-3xl text-slate-800 mb-6 pt-10 m-5">
        Model Testing
      </div>
      <form onSubmit={submitHandler}>
        <div className="flex flex-col gap-4 container border shadow-md p-3">
          <div className="flex justify-center ">
            <label className=" text-lg font-semibold text-white text-center shadow-md max-w-sm bg-emerald-700 rounded-sm px-6">
              Upload Image or Capture with Camera
            </label>
          </div>
          <input
            type="file"
            accept="image/*"
            id="image"
            onChange={inputHandler}
          />
          <button
            type="button"
            className="text-white bg-slate-800 p-1 rounded-md max-w-xs font-semibold justify-center"
            onClick={handleCamera}
          >
            Open Camera
          </button>
          <button
            disabled={!file}
            type="submit"
            className="text-white bg-slate-800 p-1 rounded-md max-w-xs font-semibold justify-center"
          >
            {loading ? 'Analysing' : 'Upload'}
          </button>
        </div>
      </form>
      <form onSubmit={videoSubmitHandler} className="mt-6">
        <div className="container border shadow-md flex flex-col gap-4 p-3">
          <div className="flex justify-center ">
            <label className="text-lg text-white bg-emerald-800 font-semibold rounded-sm shadow-md max-w-sm text-center px-6 ">
              Video Analysis
            </label>
          </div>
          <div>
            <input type="file" accept="video/*" id="video" onChange={videoHandler} />
            <button type="submit" className="text-white bg-slate-800 p-1 rounded-md max-w-xs font-semibold justify-center">
              Upload Video
            </button>
          </div>
        </div>
      </form>
      <form className="flex flex-col md:flex-row mt-6">
        {/* Folder Container */}
        <div className="flex-1 max-w-sm bg-slate-200 shadow-md p-4">
          <p className='font-semibold text-center'>Uploaded Files</p>
          <ul className='mt-6'>
            {uploadedFiles.map((fileName, index) => (
              <div className='mt-8' key={index}>
                <li>
                  <span className='text-white p-3 bg-sky-600 font-semibold rounded-md shadow-sm flex flex-wrap '>{fileName}</span>
                </li>
              </div>
            ))}
          </ul>
        </div>

        {/* Upload Files Section */}
        <div className="flex-1 mx-auto p-4 shadow-md bg-slate-100">
          <div className="flex justify-center">
            <h1 className="text-lg text-white bg-emerald-800 font-semibold text-center rounded-sm mb-4 px-6">
              Upload and Ask
            </h1>
          </div>

          {/* FileUpload Component */}
          <FileUpload onUploadSuccess={handleUploadSuccess} />

          {/* Upload Message */}
          {uploadMessage && <p className="mt-2 text-slate-800">{uploadMessage}</p>}

          {/* AskQuestion Component */}
          <AskQuestion onAnswer={handleAnswer} />

          {/* Answer Display */}
          {resp && (
            <div className="mt-4 p-4 border border-gray-300 rounded-md">
              <h2 className="text-xl font-bold">Answer:</h2>
              <p className=' text-black'>{resp}</p>
            </div>
          )}
        </div>
      </form>

      {cameraOpen && (
        <div className="mt-4">
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            className="max-w-xs border rounded-md"
          />
          <button
            onClick={captureHandler}
            className="text-white bg-slate-800 p-1 rounded-md max-w-xs font-semibold justify-center mt-2"
          >
            Capture
          </button>
        </div>
      )}
      {file && !cameraOpen && (
        <div className="mt-4">
          <img
            src={URL.createObjectURL(file)}
            alt="Uploaded Preview"
            className="max-w-xs border rounded-md"
          />
        </div>
      )}
      {!remPara && caption && (
        <div className="mt-4 text-lg text-slate-800">{caption}</div>
      )}

      {/* Video Transcription */}
      {transcription && (
        <div>
          <h2>Transcription:</h2>
          <p>{transcription}</p>
        </div>
      )}
    </>
  );
}

export default App;
