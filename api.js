import { Alert } from 'react-native';

// Standard HTTP scheme for plain Uvicorn port 8000 over Tailscale
export const API_BASE_URL = 'https://raspberrypi.tailf2a0e2.ts.net/api';

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

export const deleteWardrobeItem = async (itemId, userId = 'user_demo_123') => {
  const targetUrl = `${API_BASE_URL}/items/${itemId}`;

  try {
    const response = await fetch(targetUrl, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'X-User-Id': userId,
      },
    });

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Delete item error:', error);
    return { status: 'error', message: error.message };
  }
};

export const deleteBatchWardrobeItems = async (itemIds = [], userId = 'user_demo_123') => {
  const targetUrl = `${API_BASE_URL}/items/batch-delete`;

  try {
    const response = await fetch(targetUrl, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-User-Id': userId,
      },
      body: JSON.stringify({ item_ids: itemIds }),
    });

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Batch delete error:', error);
    return { status: 'error', message: error.message };
  }
};