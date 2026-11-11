import { Alert } from 'react-native';

export const API_BASE_URL = 'https://raspberrypi.tailf2a0e2.ts.net:8000/api';

export const getImageUrl = (relativePath) => {
  if (!relativePath) return null;
  const hostRoot = API_BASE_URL.replace('/api', '');
  return `${hostRoot}${relativePath}`;
};

export const fetchWardrobeItems = async (gender = 'Female', userId = 'user_demo_123') => {
  const targetUrl = `${API_BASE_URL}/items?gender=${gender}`;

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-User-Id': userId,
      },
    });

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    const data = await response.json();
    return { status: 'success', items: data.items || [] };
  } catch (error) {
    console.error('Fetch error:', error);
    return { status: 'error', message: error.message };
  }
};

export const uploadGarmentImage = async (formData, userId = 'user_demo_123') => {
  const targetUrl = `${API_BASE_URL}/wardrobe/upload`;

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json',
        'X-User-Id': userId,
      },
    });

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    const data = await response.json();
    return { status: 'success', data };
  } catch (error) {
    console.error('Upload error:', error);
    return { status: 'error', message: error.message };
  }
};