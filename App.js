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
  Modal,
  Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { fetchWardrobeItems, uploadGarmentImage, getImageUrl } from './api';

const { width, height } = Dimensions.get('window');

// Set a unique identifier per user account
const CURRENT_USER_ID = 'user_demo_123';

export default function App() {
  const [gender, setGender] = useState('Female');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Modal state for full-screen image expansion
  const [selectedItem, setSelectedItem] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Load wardrobe items isolated by user account and gender
  const loadWardrobe = useCallback(async (selectedGender = gender) => {
    setLoading(true);
    const result = await fetchWardrobeItems(selectedGender, CURRENT_USER_ID);
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

  const onRefresh = async () => {
    setRefreshing(true);
    await loadWardrobe(gender);
    setRefreshing(false);
  };

  const handleOpenImage = (item) => {
    setSelectedItem(item);
    setModalVisible(true);
  };

  const handleCloseImage = () => {
    setModalVisible(false);
    setSelectedItem(null);
  };

  const handlePickAndUpload = async (useCamera = false) => {
    try {
      const permissionResult = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert('Permission Denied', 'Camera or photo gallery access is required.');
        return;
      }

      const result = useCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.6,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.6,
          });

      if (result.canceled || !result.assets || !result.assets[0]) {
        return;
      }

      const selectedAsset = result.assets[0];

      const formData = new FormData();
      const imageUri = Platform.OS === 'android' 
        ? selectedAsset.uri 
        : selectedAsset.uri.replace('file://', '');

      formData.append('file', {
        uri: imageUri,
        name: selectedAsset.fileName || `garment_${Date.now()}.jpg`,
        type: selectedAsset.mimeType || 'image/jpeg',
      });

      formData.append('gender', gender);

      setUploading(true);
      const uploadRes = await uploadGarmentImage(formData, CURRENT_USER_ID);
      setUploading(false);

      if (uploadRes.status === 'success') {
        Alert.alert('Success', 'Photo uploaded! Auto-tagging in progress.');
        loadWardrobe(gender);
      } else {
        Alert.alert('Upload Failed', uploadRes.message || 'Server error during upload.');
      }
    } catch (err) {
      setUploading(false);
      console.error('Pick & Upload Error:', err);
      Alert.alert('Error', err.message || 'An unexpected error occurred while picking the image.');
    }
  };

  const renderGarmentCard = ({ item }) => (
    <TouchableOpacity 
      style={styles.card} 
      activeOpacity={0.8} 
      onPress={() => handleOpenImage(item)}
    >
      <Image
        source={{ uri: getImageUrl(item.image_path) }}
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
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Luxury Atelier Header */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Text style={styles.brandTitle}>ATELIER</Text>
          <Text style={styles.brandSubtitle}>DIGITAL WARDROBE</Text>
        </View>
        
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

      {/* Wardrobe Grid */}
      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#C5A880" />
          <Text style={styles.loadingText}>Loading Atelier Wardrobe...</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderGarmentCard}
          numColumns={2}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#C5A880']} />
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
            <ActivityIndicator size="small" color="#0F172A" />
            <Text style={styles.uploadingText}>Sending photo to Atelier Backend...</Text>
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

      {/* Full Screen Image Viewer Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseImage}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalBackgroundTouch} 
            activeOpacity={1} 
            onPress={handleCloseImage}
          >
            {selectedItem && (
              <View style={styles.expandedCard}>
                <Image
                  source={{ uri: getImageUrl(selectedItem.image_path) }}
                  style={styles.expandedImage}
                  resizeMode="contain"
                />
                <View style={styles.expandedDetails}>
                  <Text style={styles.expandedTitle}>{selectedItem.name}</Text>
                  <Text style={styles.expandedSub}>
                    {selectedItem.category} • {selectedItem.sub_type}
                  </Text>
                  <Text style={styles.expandedColor}>Color: {selectedItem.color}</Text>
                </View>
                <TouchableOpacity style={styles.closeButton} onPress={handleCloseImage}>
                  <Text style={styles.closeButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingTop: Platform.OS === 'android' ? 30 : 0,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 20 : 10,
    paddingBottom: 16,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  brandRow: {
    alignItems: 'center',
    marginBottom: 16,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '300',
    letterSpacing: 6,
    color: '#F8FAFC',
    fontFamily: Platform.OS === 'ios' ? 'Didot' : 'serif',
  },
  brandSubtitle: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 4,
    color: '#C5A880',
    marginTop: 4,
  },
  genderToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 3,
  },
  genderButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  genderButtonActive: {
    backgroundColor: '#C5A880',
  },
  genderText: {
    fontWeight: '600',
    color: '#94A3B8',
    fontSize: 13,
  },
  genderTextActive: {
    color: '#0F172A',
    fontWeight: '700',
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
    color: '#94A3B8',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  emptySubText: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 5,
  },
  listContainer: {
    padding: 10,
  },
  card: {
    flex: 0.5,
    backgroundColor: '#1E293B',
    margin: 6,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
    elevation: 2,
  },
  cardImage: {
    width: '100%',
    height: 160,
    backgroundColor: '#0F172A',
  },
  cardInfo: {
    padding: 10,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F8FAFC',
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
    backgroundColor: '#334155',
    color: '#C5A880',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: '500',
  },
  badgeTextSub: {
    fontSize: 11,
    backgroundColor: '#0F172A',
    color: '#94A3B8',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  colorText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  footerActionContainer: {
    padding: 16,
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
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
    backgroundColor: '#C5A880',
  },
  cameraButton: {
    backgroundColor: '#334155',
  },
  buttonText: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 15,
  },
  uploadingContainer: {
    flexDirection: 'row',
    backgroundColor: '#C5A880',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  uploadingText: {
    color: '#0F172A',
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackgroundTouch: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  expandedCard: {
    width: width * 0.9,
    maxHeight: height * 0.8,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  expandedImage: {
    width: '100%',
    height: height * 0.45,
    borderRadius: 12,
    backgroundColor: '#0F172A',
  },
  expandedDetails: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 12,
  },
  expandedTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  expandedSub: {
    fontSize: 14,
    color: '#C5A880',
    marginTop: 4,
    fontWeight: '500',
  },
  expandedColor: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  closeButton: {
    backgroundColor: '#C5A880',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 8,
  },
  closeButtonText: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 14,
  },
});