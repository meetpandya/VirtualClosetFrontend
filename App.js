import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  FlatList, 
  Image, 
  Alert, 
  ActivityIndicator 
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { 
  fetchWardrobeItems, 
  uploadGarmentImage, 
  deleteWardrobeItem, 
  deleteBatchWardrobeItems, 
  getImageUrl 
} from './api';

export default function App() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedGender, setSelectedGender] = useState('Female');
  const [selectedIds, setSelectedIds] = useState([]);
  const [isSelectMode, setIsSelectMode] = useState(false);

  const userId = 'user_demo_123';

  const loadGarments = async () => {
    setLoading(true);
    const res = await fetchWardrobeItems(selectedGender, userId);
    if (res.status === 'success') {
      setItems(res.items);
    } else {
      Alert.alert('Error', res.message || 'Could not fetch items');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadGarments();
  }, [selectedGender]);

  const handlePickAndUpload = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Permission to access camera roll is required!');
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7, // Slightly increased compression
      // CRITICAL FIX: Shrink the image on the client BEFORE network transfer
      maxWidth: 800,
      maxHeight: 800,
    });

    if (pickerResult.canceled) return;

    // 1. Immediately trigger the UI to show the loading spinner
    setUploading(true);

    // 2. Yield the JavaScript thread for 50ms so React Native actually renders the spinner 
    // before the heavy FormData construction and network upload block the thread.
    setTimeout(async () => {
      try {
        const asset = pickerResult.assets[0];
        const formData = new FormData();
        formData.append('file', {
          uri: asset.uri,
          name: `garment_${Date.now()}.jpg`,
          type: 'image/jpeg',
        });
        formData.append('gender', selectedGender);

        const res = await uploadGarmentImage(formData, userId);
        if (res.status === 'success') {
          // Refetch after a short delay to let DB record register
          setTimeout(() => loadGarments(), 800);
        } else {
          Alert.alert('Upload Failed', res.message);
        }
      } catch (e) {
        Alert.alert('Error', e.message);
      } finally {
        setUploading(false);
      }
    }, 50);
  };

  const handleDeleteSingle = (itemId) => {
    Alert.alert(
      'Delete Garment',
      'Are you sure you want to delete this garment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const res = await deleteWardrobeItem(itemId, userId);
            if (res.status === 'success') {
              setItems(prev => prev.filter(item => item.id !== itemId));
            } else {
              Alert.alert('Error', res.message || 'Failed to delete item.');
            }
          },
        },
      ]
    );
  };

  const handleDeleteBatch = () => {
    if (selectedIds.length === 0) return;

    Alert.alert(
      'Delete Selected Items',
      `Are you sure you want to delete ${selectedIds.length} item(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            const res = await deleteBatchWardrobeItems(selectedIds, userId);
            if (res.status === 'success') {
              setItems(prev => prev.filter(item => !selectedIds.includes(item.id)));
              setSelectedIds([]);
              setIsSelectMode(false);
            } else {
              Alert.alert('Error', res.message || 'Failed to delete selected items.');
            }
          },
        },
      ]
    );
  };

  const toggleSelectItem = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(itemId => itemId !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header Bar */}
      <View style={styles.header}>
        <Text style={styles.title}>Atelier Wardrobe</Text>
        
        {isSelectMode ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity onPress={handleDeleteBatch} style={styles.deleteBatchBtn}>
              <Text style={styles.deleteBatchText}>Delete ({selectedIds.length})</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setIsSelectMode(false); setSelectedIds([]); }}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={() => setIsSelectMode(true)}>
            <Text style={styles.selectText}>Select Mode</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Gender Toggle & Upload Action Row */}
      <View style={styles.controlsRow}>
        <View style={styles.genderToggleContainer}>
          <TouchableOpacity 
            style={[styles.genderBtn, selectedGender === 'Female' && styles.genderBtnActive]}
            onPress={() => setSelectedGender('Female')}
          >
            <Text style={[styles.genderBtnText, selectedGender === 'Female' && styles.genderBtnTextActive]}>Female</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.genderBtn, selectedGender === 'Male' && styles.genderBtnActive]}
            onPress={() => setSelectedGender('Male')}
          >
            <Text style={[styles.genderBtnText, selectedGender === 'Male' && styles.genderBtnTextActive]}>Male</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={styles.uploadBtn} 
          onPress={handlePickAndUpload}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color="#0F172A" />
          ) : (
            <Text style={styles.uploadBtnText}>+ Add Photo</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Content List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#D4AF37" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id.toString()}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isSelected = selectedIds.includes(item.id);
            return (
              <TouchableOpacity 
                activeOpacity={0.8}
                style={[styles.card, isSelected && styles.selectedCard]}
                onPress={() => isSelectMode ? toggleSelectItem(item.id) : null}
              >
                <Image source={{ uri: getImageUrl(item.image_path) }} style={styles.image} />
                <View style={styles.cardDetails}>
                  <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.itemCategory}>{item.category} • {item.color}</Text>
                </View>

                {/* Single Delete Trash Button */}
                {!isSelectMode && (
                  <TouchableOpacity 
                    style={styles.trashIcon} 
                    onPress={() => handleDeleteSingle(item.id)}
                  >
                    <Text style={styles.trashIconText}>✕</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 54, paddingHorizontal: 16, backgroundColor: '#0F172A' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '700', color: '#E2E8F0', letterSpacing: 0.5 },
  selectText: { color: '#D4AF37', fontSize: 15, fontWeight: '600' },
  cancelText: { color: '#94A3B8', fontSize: 15 },
  deleteBatchBtn: { backgroundColor: '#EF4444', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  deleteBatchText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  controlsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  genderToggleContainer: { flexDirection: 'row', backgroundColor: '#1E293B', borderRadius: 8, padding: 3 },
  genderBtn: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 6 },
  genderBtnActive: { backgroundColor: '#D4AF37' },
  genderBtnText: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
  genderBtnTextActive: { color: '#0F172A', fontWeight: '700' },
  uploadBtn: { backgroundColor: '#D4AF37', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8 },
  uploadBtnText: { color: '#0F172A', fontWeight: '700', fontSize: 14 },
  listContent: { paddingBottom: 24 },
  card: { flex: 0.5, margin: 6, backgroundColor: '#1E293B', borderRadius: 10, overflow: 'hidden', position: 'relative' },
  selectedCard: { borderWidth: 2, borderColor: '#EF4444' },
  image: { width: '100%', height: 160, backgroundColor: '#334155' },
  cardDetails: { padding: 8 },
  itemName: { color: '#F8FAFC', fontSize: 13, fontWeight: '600' },
  itemCategory: { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  trashIcon: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(15, 23, 42, 0.75)', width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  trashIconText: { color: '#EF4444', fontWeight: 'bold', fontSize: 12 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});