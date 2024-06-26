import React, { useState } from 'react';
import axios from 'axios';

const AskQuestion = ({ onAnswer }) => {
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleAsk = async () => {
    setIsLoading(true);
    try {
      const response = await axios.post('http://localhost:3001/ask', { question });
      onAnswer(response.data.answer);
    } catch (error) {
      console.error('Error asking question:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-4">
      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        className="w-full border border-gray-300 rounded-md p-2"
        rows="3"
        placeholder="Type your question here..."
      ></textarea>
      <button
        onClick={handleAsk}
        className="bg-blue-500 text-white px-4 py-2 rounded-md mt-2"
        disabled={isLoading}
      >
        {isLoading ? 'Asking...' : 'Ask'}
      </button>
    </div>
  );
};

export default AskQuestion;