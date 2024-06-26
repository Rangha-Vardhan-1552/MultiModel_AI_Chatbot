import React, { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';

const FileUpload = ({ onUploadSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);

  const onDrop = useCallback(async (acceptedFiles) => {
    const formData = new FormData();
    acceptedFiles.forEach((file) => {
      formData.append('files', file);
    });

    setIsLoading(true);
    try {
      const response = await axios.post('http://localhost:3001/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      const newUploadedFiles = acceptedFiles.map(file => file.name);
      setUploadedFiles(prevFiles => [...prevFiles, ...newUploadedFiles]);
    } catch (error) {
      console.error('Error uploading files:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (uploadedFiles.length > 0) {
      onUploadSuccess('Files uploaded successfully', uploadedFiles);
    }
  }, [onUploadSuccess, uploadedFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: true });

  return (
    <div>
      <div {...getRootProps()} className="border-4 border-dashed border-gray-300 rounded-md p-12 text-center cursor-pointer">
        <input {...getInputProps()} />
        {isLoading ? (
          <p>Loading...</p>
        ) : isDragActive ? (
          <p>Drop the files here...</p>
        ) : (
          <p>Drag 'n' drop some files here, or click to select files</p>
        )}
      </div>
      {/* <div className="mt-4">
        <h3>Uploaded Files:</h3>
        <ul>
          {uploadedFiles.map((fileName, index) => (
            <li key={index}>{fileName}</li>
          ))}
        </ul>
      </div> */}
    </div>
  );
};

export default FileUpload;
