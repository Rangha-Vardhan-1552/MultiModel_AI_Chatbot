import React, { useState } from 'react';
import axios from 'axios';

function App() {
  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState('');

  const inputHandler = (event) => {
    setFile(event.target.files[0]);
  };

  const submitHandler = async (event) => {
    event.preventDefault();
    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await axios.post('http://localhost:3001/image-caption', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      setCaption(response.data.generated_text);
    } catch (error) {
      console.error('Error uploading the file', error);
    }
  };

  return (
    <>
      <div className='flex justify-center text-3xl text-slate-800 mb-6 pt-10'>
        Model Testing
      </div>
      <form onSubmit={submitHandler}>
        <div className='flex flex-col gap-4 container border shadow-md p-3'>
          <label className='text-lg font-semibold text-slate-600'>
            Upload Image
          </label>
          <input
            type='file'
            accept='image/*'
            id='image'
            onChange={inputHandler}
          />
          <button
            type='submit'
            className='text-white bg-slate-800 p-1 rounded-md max-w-xs font-semibold justify-center'
          >
            Upload
          </button>
        </div>
      </form>
      {file && (
        <div className='mt-4'>
          <img
            src={URL.createObjectURL(file)}
            alt='Uploaded Preview'
            className='max-w-xs border rounded-md'
          />
        </div>
      )}
      {caption && (
        <div className='mt-4 text-lg text-slate-800'>{caption}</div>
      )}
    </>
  );
}

export default App;
