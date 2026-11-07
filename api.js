import { Alert } from 'react-native';

export const API_BASE_URL = 'https://raspberrypi.tailf2a0e2.ts.net/api';

/**
 * Helper to turn relative backend image paths (/uploads/...) into full URLs
 */
export const getImageUrl = (relativePath) => {
  if (!relativePath) return null;
  const hostRoot = API_BASE_URL.replace('/api', '');
  return `${hostRoot}${relativePath}`;
};

/**
 * Fetch wardrobe items filtered by gender.
 */
export const fetchWardrobeItems = async (gender = 'Female') => {
  const targetUrl = `${API_BASE_URL}/items?gender=${gender}`;
  console.log('Sending request to:', targetUrl);

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    const data = await response.json();
    return { status: 'success', items: data.items || data };
  } catch (error) {
    console.error('FETCH ERROR DETAILS:', error);

    Alert.alert(
      'Diagnostic Network Error',
      `Target URL: ${targetUrl}\n\nError Message: ${error.message}`
    );

    return { status: 'error', message: error.message };
  }
};

/**
 * Upload a new garment image with metadata to the Raspberry Pi backend.
 */
export const uploadGarmentImage = async (formData) => {
  // Fixed endpoint from /items/upload to /wardrobe/upload to match main.py
  const targetUrl = `${API_BASE_URL}/items/upload`;

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    const data = await response.json();
    return { status: 'success', data };
  } catch (error) {
    console.error('UPLOAD ERROR DETAILS:', error);

    Alert.alert(
      'Diagnostic Upload Error',
      `Target URL: ${targetUrl}\n\nError Message: ${error.message}`
    );

    return { status: 'error', message: error.message };
  }
};