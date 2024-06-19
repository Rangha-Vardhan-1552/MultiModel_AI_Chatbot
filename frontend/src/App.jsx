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

  const inputHandler = (event) => {
    setRemPara(true);
    setFile(event.target.files[0]);
  };

  const captureHandler = () => {
    const imageSrc = webcamRef.current.getScreenshot();
    const blob = dataURLtoFile(imageSrc, 'captured_image.png');
    console.log(blob)
    setFile(blob);
    setCameraOpen(false);
  };

  const submitHandler = async (event) => {
    event.preventDefault();
    setRemPara(false);
    setLoading(true);
    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await axios.post('http://localhost:3001/image-caption', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
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
            onClick={() => setCameraOpen(true)}
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
      {remPara ? "" : caption && (
        <div className='mt-4 text-lg text-slate-800'>{caption}</div>
      )}
    </>
  );
}

export default App;
