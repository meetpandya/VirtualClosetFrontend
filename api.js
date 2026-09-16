import { Platform } from 'react-native';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://count-spas-sister-volunteer.trycloudflare.com/api';

// Helper to format native image file URIs for Android/iOS
const formatNativeUri = (uri) => {
  return Platform.OS === 'android' ? uri : uri.replace('file://', '');
};

export const fetchDailyOutfits = async (temp = 16, condition = 'Rain') => {
  try {
    const response = await fetch(`${API_BASE_URL}/outfits/daily?temp=${temp}&condition=${condition}`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching daily outfits:', error);
    return { status: 'error', outfits: [] };
  }
};

export const selectWearOutfit = async (itemIds, occasion = 'Daily Outfit') => {
  try {
    const response = await fetch(`${API_BASE_URL}/outfits/select`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item_ids: itemIds,
        occasion: occasion,
        temperature: 16.0,
        weather_condition: 'Rain'
      }),
    });
    return await response.json();
  } catch (error) {
    console.error('Error marking outfit as worn:', error);
    return { status: 'error' };
  }
};

// --- Single Photo Upload (Camera Capture or Single Item) ---
export const uploadGarmentPhoto = async (imageUri, gender = 'Female') => {
  try {
    const formData = new FormData();
    formData.append('file', {
      uri: formatNativeUri(imageUri),
      name: `garment_${Date.now()}.jpg`,
      type: 'image/jpeg',
    });
    formData.append('gender', gender);

    const response = await fetch(`${API_BASE_URL}/wardrobe/upload`, {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json',
      },
    });

    return await response.json();
  } catch (error) {
    console.error('Single upload failed:', error);
    return { status: 'error', message: error.message };
  }
};

// --- Batch Photo Upload (Multiple Gallery Items) ---
export const uploadGarmentBatch = async (imageUris, gender = 'Female') => {
  try {
    const formData = new FormData();

    imageUris.forEach((uri, index) => {
      formData.append('files', {
        uri: formatNativeUri(uri),
        name: `garment_${index}_${Date.now()}.jpg`,
        type: 'image/jpeg',
      });
    });

    formData.append('gender', gender);

    const response = await fetch(`${API_BASE_URL}/wardrobe/batch-upload`, {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json',
      },
    });

    return await response.json();
  } catch (error) {
    console.error('Batch upload failed:', error);
    return { status: 'error', message: error.message };
  }
};

export const fetchWardrobeItems = async (gender = 'Female') => {
  try {
    const response = await fetch(`${API_BASE_URL}/wardrobe/items?gender=${gender}`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching wardrobe items:', error);
    return { status: 'error', items: [] };
  }
};

export const deleteGarmentItem = async (itemId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/wardrobe/items/${itemId}`, {
      method: 'DELETE',
    });
    return await response.json();
  } catch (error) {
    console.error('Error deleting item:', error);
    return { status: 'error' };
  }
};