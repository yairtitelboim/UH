import axios from 'axios';

const API_URL = 'https://evalv01-53aff151fb55.herokuapp.com';

export const validateArticle = async (article) => {
  try {
    const response = await axios.post(`${API_URL}/validate`, article, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const applyUpdates = async (updatedData) => {
  try {
    const response = await axios.post(`${API_URL}/apply`, updatedData, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};
