import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  RefreshControl,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { fetchWardrobeItems, uploadGarmentPhoto } from './src/services/api';

export default function App() {
  const [gender, setGender] = useState('Female');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Load wardrobe items from local Pi backend
  const loadWardrobe = useCallback(async (selectedGender = gender) => {
    setLoading(true);
    const result = await fetchWardrobeItems(selectedGender);
    if (result.status === 'success') {
      setItems(result.items);
    } else {
      Alert.alert('Network Error', 'Could not fetch items from Raspberry Pi backend.');
    }
    setLoading(false);
  }, [gender]);

  useEffect(() => {
    loadWardrobe(gender);
  }, [gender, loadWardrobe]);

  // Pull-to-refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    await loadWardrobe(gender);
    setRefreshing(false);
  };

  // Image Picker & Fast Local Upload
  const handlePickAndUpload = async (useCamera = false) => {
    try {
      // 1. Request Permissions
      const permissionResult = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert('Permission Denied', 'Camera/Gallery access is required to upload clothing.');
        return;
      }

      // 2. Launch Camera or Gallery with compression
      const result = useCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.6, // Compressed to prevent heavy Wi-Fi transfers
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.6,
          });

      if (result.canceled || !result.assets || !result.assets[0]) {
        return;
      }

      const selectedUri = result.assets[0].uri;

      // 3. Trigger Non-blocking Local Upload
      setUploading(true);
      const uploadRes = await uploadGarmentPhoto(selectedUri, gender);
      setUploading(false);

      if (uploadRes.status === 'success') {
        // Immediately refresh the grid list
        loadWardrobe(gender);
      } else {
        Alert.alert('Upload Failed', uploadRes.message || 'Server error occurred during upload.');
      }
    } catch (err) {
      setUploading(false);
      console.error('Pick & Upload Error:', err);
      Alert.alert('Error', 'An unexpected error occurred while picking the image.');
    }
  };

  // Render Item Card
  const renderGarmentCard = ({ item }) => (
    <View style={styles.card}>
      <Image
        source={{ uri: item.image_url }}
        style={styles.cardImage}
        resizeMode="cover"
      />
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle}>{item.name}</Text>
        <View style={styles.badgeContainer}>
          <Text style={styles.badgeText}>{item.category}</Text>
          <Text style={styles.badgeTextSub}>{item.sub_type}</Text>
        </View>
        <Text style={styles.colorText}>Color: {item.color}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Virtual Closet</Text>
        
        {/* Gender Filter Toggle */}
        <View style={styles.genderToggleContainer}>
          <TouchableOpacity
            style={[styles.genderButton, gender === 'Female' && styles.genderButtonActive]}
            onPress={() => setGender('Female')}
          >
            <Text style={[styles.genderText, gender === 'Female' && styles.genderTextActive]}>
              Female
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.genderButton, gender === 'Male' && styles.genderButtonActive]}
            onPress={() => setGender('Male')}
          >
            <Text style={[styles.genderText, gender === 'Male' && styles.genderTextActive]}>
              Male
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content / Wardrobe Grid */}
      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loadingText}>Loading Wardrobe...</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderGarmentCard}
          numColumns={2}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4F46E5']} />
          }
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <Text style={styles.emptyText}>No garments found for {gender}.</Text>
              <Text style={styles.emptySubText}>Tap below to add your first photo!</Text>
            </View>
          }
        />
      )}

      {/* Action Buttons */}
      <View style={styles.footerActionContainer}>
        {uploading ? (
          <View style={styles.uploadingContainer}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text style={styles.uploadingText}>Sending photo to Raspberry Pi...</Text>
          </View>
        ) : (
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.galleryButton]}
              onPress={() => handlePickAndUpload(false)}
            >
              <Text style={styles.buttonText}>Choose Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.cameraButton]}
              onPress={() => handlePickAndUpload(true)}
            >
              <Text style={styles.buttonText}>Take Photo</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingTop: Platform.OS === 'android' ? 30 : 0,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },
  genderToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 4,
  },
  genderButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  genderButtonActive: {
    backgroundColor: '#4F46E5',
  },
  genderText: {
    fontWeight: '600',
    color: '#4B5563',
  },
  genderTextActive: {
    color: '#FFFFFF',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 40,
  },
  loadingText: {
    marginTop: 10,
    color: '#6B7280',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  emptySubText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 5,
  },
  listContainer: {
    padding: 10,
  },
  card: {
    flex: 0.5,
    backgroundColor: '#FFFFFF',
    margin: 6,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  cardImage: {
    width: '100%',
    height: 160,
    backgroundColor: '#F3F4F6',
  },
  cardInfo: {
    padding: 10,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 6,
  },
  badgeContainer: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  badgeText: {
    fontSize: 11,
    backgroundColor: '#EEF2FF',
    color: '#4F46E5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: '500',
  },
  badgeTextSub: {
    fontSize: 11,
    backgroundColor: '#F3F4F6',
    color: '#4B5563',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  colorText: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  footerActionContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryButton: {
    backgroundColor: '#4F46E5',
  },
  cameraButton: {
    backgroundColor: '#10B981',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
  uploadingContainer: {
    flexDirection: 'row',
    backgroundColor: '#4F46E5',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  uploadingText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});