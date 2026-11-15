export const API_BASE_URL = 'https://raspberrypi.tailf2a0e2.ts.net/api';

export const getImageUrl = (relativePath) => {
  if (!relativePath) return null;
  const hostRoot = API_BASE_URL.replace('/api', '');
  return `${hostRoot}${relativePath}`;
};

export const fetchWardrobeItems = async (userId) => {
  const targetUrl = `${API_BASE_URL}/items`;

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

export const deleteBatchWardrobeItems = async (itemIds = [], userId) => {
  const targetUrl = `${API_BASE_URL}/items/batch-delete`;
  const numericIds = itemIds.map((id) => Number(id));

  try {
    const response = await fetch(targetUrl, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-User-Id': userId,
      },
      body: JSON.stringify({ item_ids: numericIds }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Server returned HTTP ${response.status}:`, errorText);
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Batch delete error:', error);
    return { status: 'error', message: error.message };
  }
};