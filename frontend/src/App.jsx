import React, { useState, useRef } from 'react';
import axios from 'axios';
import Webcam from 'react-webcam';

function App() {
  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);
  const [remPara, setRemPara] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const webcamRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [transcription, setTranscription] = useState('');

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


  //video uploading
  const videoHandler =(event)=>{
    setSelectedFile(event.target.files[0]);
  }
  const videoSubmitHander=async(event)=>{
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
      console.log(response.data.text)
      setTranscription(response.data.text);
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Error uploading file');
    }
  }

  return (
    <>
      <div className='flex justify-center text-3xl text-slate-800 mb-6 pt-10'>
        Model Testing
      </div>
      <form onSubmit={submitHandler}>
        <div className='flex flex-col gap-4 container border shadow-md p-3'>
          <label className='text-lg font-semibold text-slate-600'>
            Upload Image or Capture with Camera
          </label>
          <input
            type='file'
            accept='image/*'
            id='image'
            onChange={inputHandler}
          />
          <button
            type='button'
            className='text-white bg-slate-800 p-1 rounded-md max-w-xs font-semibold justify-center'
            onClick={handleCamera}
          >
            Open Camera
          </button>
          <button
            disabled={!file}
            type='submit'
            className='text-white bg-slate-800 p-1 rounded-md max-w-xs font-semibold justify-center'
          >
            {loading ? 'Analysing' : 'Upload'}
          </button>
        </div>
      </form>
      <form onSubmit={videoSubmitHander} className='mt-6'>
        <div className='container border shadow-md flex flex-col gap-4 p-6'>
            <div>Face recognition</div>
            <div>
              <input type='file' accept='video/*' id='video' onChange={videoHandler}/>
              <button className='text-white bg-slate-800 p-1 rounded-md max-w-xs font-semibold justify-center' >upload Video</button>
            </div>
          </div>
      </form>
      {cameraOpen && (
        <div className='mt-4'>
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat='image/jpeg'
            className='max-w-xs border rounded-md'
          />
          <button
            onClick={captureHandler}
            className='text-white bg-slate-800 p-1 rounded-md max-w-xs font-semibold justify-center mt-2'
          >
            Capture
          </button>
        </div>
      )}
      {file && !cameraOpen && (
        <div className='mt-4'>
          <img
            src={URL.createObjectURL(file)}
            alt='Uploaded Preview'
            className='max-w-xs border rounded-md'
          />
        </div>
      )}
      {!remPara && caption && (
        <div className='mt-4 text-lg text-slate-800'>{caption}</div>
      )}
      
      {/* video transcription */}
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
