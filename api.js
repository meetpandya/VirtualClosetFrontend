import { Platform } from 'react-native';

// Point directly to your Pi's local network IP on port 8000
export const API_BASE_URL = 'http://192.168.50.13:8000/api';

/**
 * Uploads a garment photo to the local FastAPI backend.
 */
export const uploadGarmentPhoto = async (imageUri, gender = 'Female') => {
  console.log('--- STARTING LOCAL UPLOAD ---');
  console.log('Target API Endpoint:', `${API_BASE_URL}/wardrobe/upload`);

  try {
    const formData = new FormData();
    
    // Format URI cleanly for Android vs iOS
    const cleanUri = Platform.OS === 'android' ? imageUri : imageUri.replace('file://', '');

    formData.append('file', {
      uri: cleanUri,
      name: `garment_${Date.now()}.jpg`,
      type: 'image/jpeg',
    });
    formData.append('gender', gender);

    // Note: Do NOT manually set 'Content-Type': 'multipart/form-data'
    const response = await fetch(`${API_BASE_URL}/wardrobe/upload`, {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json',
      },
    });

    console.log('Upload HTTP Status:', response.status);
    const data = await response.json();
    console.log('Upload Response Data:', data);
    return data;
  } catch (error) {
    console.error('Upload API Error:', error);
    return { status: 'error', message: error.message };
  }
};

/**
 * Fetches wardrobe items list and maps local IP host to static image paths.
 */
export const fetchWardrobeItems = async (gender = 'Female') => {
  try {
    const response = await fetch(`${API_BASE_URL}/wardrobe/items?gender=${encodeURIComponent(gender)}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    const data = await response.json();
    if (data.status === 'success') {
      const hostUrl = API_BASE_URL.replace('/api', '');
      const itemsWithFullUrls = data.items.map((item) => ({
        ...item,
        image_url: `${hostUrl}${item.image_path}`,
      }));
      return { status: 'success', items: itemsWithFullUrls };
    }
    return data;
  } catch (error) {
    console.error('Fetch Items API Error:', error);
    return { status: 'error', items: [] };
  }
};