import { Platform } from 'react-native';

// Update this URL whenever your cloudflared tunnel regenerates
export const API_BASE_URL = 'https://scan-firewire-entire-holdem.trycloudflare.com/api';

/**
 * Uploads a garment photo to the FastAPI backend.
 */
export const uploadGarmentPhoto = async (imageUri, gender = 'Female') => {
  console.log('--- STARTING UPLOAD ---');
  console.log('Target API Endpoint:', `${API_BASE_URL}/wardrobe/upload`);

  try {
    const formData = new FormData();
    
    // Format URI for Android vs iOS
    const cleanUri = Platform.OS === 'android' ? imageUri : imageUri.replace('file://', '');

    formData.append('file', {
      uri: cleanUri,
      name: `garment_${Date.now()}.jpg`,
      type: 'image/jpeg',
    });
    formData.append('gender', gender);

    // Note: Do NOT explicitly add 'Content-Type': 'multipart/form-data'
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
 * Fetches the wardrobe items list for a specific gender filter.
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
      // Map base host URL to image relative paths so <Image /> component can resolve them
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