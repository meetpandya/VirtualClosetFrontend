// Replace 192.168.1.XX with your PC's Wi-Fi IP address from ipconfig
const API_BASE_URL = 'http://192.168.50.52:8000/api';
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

export const uploadGarmentPhoto = async (imageUri, gender = 'Female') => {
  try {
    const formData = new FormData();
    formData.append('file', {
      uri: imageUri,
      name: 'garment.jpg',
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
    console.error('Upload failed:', error);
    return { status: 'error' };
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