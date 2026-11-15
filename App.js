import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { API_BASE_URL, deleteBatchWardrobeItems } from './api';

const FEMALE_CATEGORIES = [
  'All',
  'Dresses',
  'Tops',
  'Bottoms',
  'Outwear and Jackets',
  'Denim',
  'Sweaters',
  'Footwear',
  'Bags',
];

const MALE_CATEGORIES = [
  'All',
  'Tshirts',
  'Shirts',
  'Polos',
  'Jeans',
  'Bottoms',
  'Sweatshirts',
  'Sweaters',
  'Hoodies',
  'Coats and Jackets',
  'Shoes',
];

export default function App() {
  const [userSession, setUserSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);

  // Auth Form States
  const [isRegistering, setIsRegistering] = useState(false);
  const [firstNameInput, setFirstNameInput] = useState('');
  const [lastNameInput, setLastNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [genderInput, setGenderInput] = useState('Male');
  const [authLoading, setAuthLoading] = useState(false);

  // Wardrobe States
  const [items, setItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [refreshing, setRefreshing] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(null);

  // Enlarged Garment Modal State
  const [enlargedItem, setEnlargedItem] = useState(null);

  const HOST_ROOT = API_BASE_URL.replace('/api', '');

  useEffect(() => {
    checkPersistedSession();
  }, []);

  useEffect(() => {
    if (userSession) {
      setSelectedCategory('All');
      fetchItems();
    }
  }, [userSession]);

  const checkPersistedSession = async () => {
    try {
      const savedSession = await AsyncStorage.getItem('@atelier_session');
      if (savedSession) {
        setUserSession(JSON.parse(savedSession));
      }
    } catch (e) {
      console.error('Failed to load session', e);
    } finally {
      setLoadingSession(false);
    }
  };

  const handleAuth = async () => {
    if (!emailInput.trim() || !passwordInput.trim()) {
      Alert.alert('Error', 'Please enter your email and password.');
      return;
    }
    if (isRegistering && !firstNameInput.trim()) {
      Alert.alert('Error', 'Please enter your first name.');
      return;
    }

    setAuthLoading(true);
    const endpoint = isRegistering ? '/api/register' : '/api/login';
    const payload = isRegistering
      ? {
          first_name: firstNameInput.trim(),
          last_name: lastNameInput.trim(),
          email: emailInput.trim(),
          password: passwordInput,
          gender: genderInput,
        }
      : {
          email: emailInput.trim(),
          password: passwordInput,
        };

    try {
      const response = await fetch(`${HOST_ROOT}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      let data = {};
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      }

      if (response.ok) {
        const sessionData = {
          email: data.user_id,
          firstName: data.first_name,
          gender: data.gender,
        };
        await AsyncStorage.setItem('@atelier_session', JSON.stringify(sessionData));
        setUserSession(sessionData);
        setEmailInput('');
        setPasswordInput('');
        setFirstNameInput('');
        setLastNameInput('');
      } else {
        Alert.alert('Authentication Failed', data.detail || 'Something went wrong.');
      }
    } catch (error) {
      Alert.alert('Network Error', 'Could not connect to the Raspberry Pi server.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem('@atelier_session');
          setUserSession(null);
          setItems([]);
          setSelectedCategory('All');
          setIsSelectMode(false);
          setSelectedItemIds([]);
        },
      },
    ]);
  };

  const fetchItems = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/items`, {
        headers: { 'X-User-Id': userSession.email },
      });
      const data = await response.json();
      if (data.status === 'success') {
        setItems(data.items);
      }
    } catch (error) {
      console.error('Failed to fetch items:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const pickImageAndUpload = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: 10,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const assets = result.assets;
        const uploadUrl = `${API_BASE_URL}/wardrobe/upload`;
        let failedCount = 0;

        for (let i = 0; i < assets.length; i++) {
          setUploadProgress(`Uploading ${i + 1}/${assets.length}...`);
          const asset = assets[i];
          const localUri = asset.uri;
          const filename = asset.fileName || localUri.split('/').pop() || `garment_${Date.now()}_${i}.jpg`;

          const formData = new FormData();
          formData.append('file', {
            uri: localUri,
            name: filename,
            type: asset.mimeType || 'image/jpeg',
          });
          formData.append('gender', userSession.gender);

          try {
            const response = await fetch(uploadUrl, {
              method: 'POST',
              headers: {
                'X-User-Id': userSession.email,
              },
              body: formData,
            });

            if (!response.ok) {
              failedCount++;
            }
          } catch (err) {
            failedCount++;
          }
        }

        setUploadProgress(null);
        fetchItems();

        setTimeout(() => fetchItems(), 3000);
        setTimeout(() => fetchItems(), 7000);

        if (failedCount > 0) {
          Alert.alert('Partial Upload', `${failedCount} of ${assets.length} image(s) failed to upload.`);
        }
      }
    } catch (error) {
      setUploadProgress(null);
      Alert.alert('Error', 'Failed to open gallery or upload images.');
    }
  };

  const toggleSelectItem = (id) => {
    if (selectedItemIds.includes(id)) {
      const updated = selectedItemIds.filter((itemId) => itemId !== id);
      setSelectedItemIds(updated);
      if (updated.length === 0) {
        setIsSelectMode(false);
      }
    } else {
      setSelectedItemIds([...selectedItemIds, id]);
    }
  };

  const deleteSelectedItems = async () => {
    if (selectedItemIds.length === 0) return;

    Alert.alert(
      'Delete Garments',
      `Are you sure you want to delete ${selectedItemIds.length} selected item(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteBatchWardrobeItems(selectedItemIds, userSession.email);
            if (result.status === 'success') {
              setSelectedItemIds([]);
              setIsSelectMode(false);
              fetchItems();
            } else {
              Alert.alert('Error', result.message || 'Failed to delete items.');
            }
          },
        },
      ]
    );
  };

  const hasValidBrand = (brand) => {
    if (!brand) return false;
    const cleaned = brand.trim().toLowerCase();
    return cleaned !== '' && cleaned !== 'unbranded' && cleaned !== 'unknown' && cleaned !== 'none';
  };

  const formatCardSubtitle = (item) => {
    const garmentType = item.type || item.sub_type;
    const parts = hasValidBrand(item.brand)
      ? [item.brand, item.color, garmentType]
      : [item.color, garmentType];
    return parts.filter((val) => val && val.trim() !== '').join(' • ');
  };

  if (loadingSession) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#f59e0b" />
      </View>
    );
  }

  if (!userSession) {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.authContainer}>
            <Text style={styles.appTitle}>Atelier</Text>
            <Text style={styles.appSubtitle}>Luxury Digital Wardrobe</Text>

            {isRegistering && (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="First Name"
                  placeholderTextColor="#888"
                  value={firstNameInput}
                  onChangeText={setFirstNameInput}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Last Name (Optional)"
                  placeholderTextColor="#888"
                  value={lastNameInput}
                  onChangeText={setLastNameInput}
                />

                <Text style={styles.label}>Select Wardrobe Type:</Text>
                <View style={styles.authGenderContainer}>
                  <TouchableOpacity
                    style={[styles.authGenderTab, genderInput === 'Male' && styles.authActiveGenderTab]}
                    onPress={() => setGenderInput('Male')}
                  >
                    <Text style={[styles.authGenderText, genderInput === 'Male' && styles.authActiveGenderText]}>
                      Male
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.authGenderTab, genderInput === 'Female' && styles.authActiveGenderTab]}
                    onPress={() => setGenderInput('Female')}
                  >
                    <Text style={[styles.authGenderText, genderInput === 'Female' && styles.authActiveGenderText]}>
                      Female
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            <TextInput
              style={styles.input}
              placeholder="Email Address"
              placeholderTextColor="#888"
              autoCapitalize="none"
              keyboardType="email-address"
              value={emailInput}
              onChangeText={setEmailInput}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#888"
              secureTextEntry
              value={passwordInput}
              onChangeText={setPasswordInput}
            />

            <TouchableOpacity style={styles.primaryButton} onPress={handleAuth} disabled={authLoading}>
              {authLoading ? (
                <ActivityIndicator color="#0f172a" />
              ) : (
                <Text style={styles.primaryButtonText}>{isRegistering ? 'Create Account' : 'Sign In'}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setIsRegistering(!isRegistering)} style={styles.switchAuthText}>
              <Text style={styles.switchTextNormal}>
                {isRegistering ? 'Already have an account? ' : "Don't have an account? "}
                <Text style={styles.switchTextHighlight}>{isRegistering ? 'Sign In' : 'Register'}</Text>
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  const availableCategories =
    userSession.gender?.toLowerCase() === 'female' ? FEMALE_CATEGORIES : MALE_CATEGORIES;

  const filteredItems =
    selectedCategory === 'All'
      ? items
      : items.filter((item) => item.category === selectedCategory);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerTitle}>Atelier</Text>
          <Text style={styles.loggedUserText}>Welcome back, {userSession.firstName}!</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.controlsRow}>

        <View style={styles.actionButtons}>
          {isSelectMode ? (
            <TouchableOpacity
              style={styles.cancelBatchButton}
              onPress={() => {
                setIsSelectMode(false);
                setSelectedItemIds([]);
              }}
            >
              <Text style={styles.cancelBatchButtonText}>Cancel</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={[styles.addButton, uploadProgress && { opacity: 0.7 }]}
            onPress={pickImageAndUpload}
            disabled={uploadProgress !== null}
          >
            <Text style={styles.addButtonText}>{uploadProgress || '+ Add Photo'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Horizontal Category Filter Tabs */}
      <View style={styles.categoryBarWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryBarContent}
        >
          {availableCategories.map((category) => {
            const isActive = selectedCategory === category;
            return (
              <TouchableOpacity
                key={category}
                style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                onPress={() => setSelectedCategory(category)}
              >
                <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}>
                  {category}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {isSelectMode && selectedItemIds.length > 0 && (
        <TouchableOpacity style={styles.deleteBar} onPress={deleteSelectedItems}>
          <Text style={styles.deleteBarText}>Delete Selected ({selectedItemIds.length})</Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id.toString()}
        numColumns={2}
        contentContainerStyle={styles.gridContainer}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          fetchItems();
        }}
        renderItem={({ item }) => {
          const isSelected = selectedItemIds.includes(item.id);
          return (
            <TouchableOpacity
              style={[styles.card, isSelected && styles.selectedCard]}
              activeOpacity={0.8}
              onPress={() => {
                if (isSelectMode) {
                  toggleSelectItem(item.id);
                } else {
                  setEnlargedItem(item);
                }
              }}
              onLongPress={() => {
                if (!isSelectMode) {
                  setIsSelectMode(true);
                  setSelectedItemIds([item.id]);
                }
              }}
            >
              <Image
                source={{ uri: `${HOST_ROOT}${item.image_path}` }}
                style={styles.cardImage}
                resizeMode="contain"
              />
              <View style={styles.cardInfo}>
                <Text style={styles.cardName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.cardSub} numberOfLines={1}>
                  {formatCardSubtitle(item)}
                </Text>
              </View>

              {isSelectMode && (
                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                  {isSelected && <Text style={styles.checkmark}>✓</Text>}
                </View>
              )}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {items.length === 0
                ? 'Your wardrobe is empty. Tap "+ Add Photo" to start!'
                : `No items in "${selectedCategory}".`}
            </Text>
          </View>
        }
      />

      <Modal
        visible={enlargedItem !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setEnlargedItem(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setEnlargedItem(null)}>
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
            {enlargedItem && (
              <>
                <Image
                  source={{ uri: `${HOST_ROOT}${enlargedItem.image_path}` }}
                  style={styles.enlargedImage}
                  resizeMode="contain"
                />
                <Text style={styles.modalTitle}>{enlargedItem.name}</Text>
                <View style={styles.modalDetailsBox}>
                  <Text style={styles.modalDetailRow}>
                    <Text style={styles.modalDetailLabel}>Category: </Text>
                    {enlargedItem.category || 'Uncategorized'}
                  </Text>
                  {hasValidBrand(enlargedItem.brand) && (
                    <Text style={styles.modalDetailRow}>
                      <Text style={styles.modalDetailLabel}>Brand: </Text>
                      {enlargedItem.brand}
                    </Text>
                  )}
                  <Text style={styles.modalDetailRow}>
                    <Text style={styles.modalDetailLabel}>Color: </Text>
                    {enlargedItem.color || 'Unknown'}
                  </Text>
                  <Text style={styles.modalDetailRow}>
                    <Text style={styles.modalDetailLabel}>Type: </Text>
                    {enlargedItem.type || enlargedItem.sub_type || 'Garment'}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centerContainer: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: '#0f172a' },
  authContainer: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  appTitle: { fontSize: 36, fontWeight: 'bold', color: '#f8fafc', textAlign: 'center', letterSpacing: 1 },
  appSubtitle: { fontSize: 14, color: '#94a3b8', textAlign: 'center', marginBottom: 32, letterSpacing: 2, textTransform: 'uppercase' },
  label: { color: '#94a3b8', fontSize: 14, marginBottom: 8 },
  authGenderContainer: { flexDirection: 'row', backgroundColor: '#1e293b', borderRadius: 8, marginBottom: 16, borderWidth: 1, borderColor: '#334155', padding: 2 },
  authGenderTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 6 },
  authActiveGenderTab: { backgroundColor: '#f59e0b' },
  authGenderText: { color: '#94a3b8', fontWeight: '600' },
  authActiveGenderText: { color: '#0f172a' },
  input: { backgroundColor: '#1e293b', color: '#f8fafc', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 8, fontSize: 16, marginBottom: 16, borderWidth: 1, borderColor: '#334155' },
  primaryButton: { backgroundColor: '#f59e0b', paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  primaryButtonText: { color: '#0f172a', fontSize: 16, fontWeight: 'bold' },
  switchAuthText: { marginTop: 20, alignItems: 'center' },
  switchTextNormal: { color: '#94a3b8', fontSize: 14 },
  switchTextHighlight: { color: '#f59e0b', fontWeight: 'bold' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#f8fafc' },
  loggedUserText: { fontSize: 13, color: '#f59e0b', fontWeight: '600' },
  logoutButton: { backgroundColor: '#1e293b', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#334155' },
  logoutText: { color: '#ef4444', fontSize: 12, fontWeight: '600' },
  controlsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10 },
  wardrobeSubtitle: { color: '#94a3b8', fontSize: 13, fontWeight: '500' },
  actionButtons: { flexDirection: 'row', gap: 8 },
  cancelBatchButton: { backgroundColor: '#334155', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  cancelBatchButtonText: { color: '#f8fafc', fontSize: 13, fontWeight: '600' },
  addButton: { backgroundColor: '#f59e0b', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  addButtonText: { color: '#0f172a', fontSize: 13, fontWeight: 'bold' },
  categoryBarWrapper: { marginBottom: 10 },
  categoryBarContent: { paddingHorizontal: 16, gap: 8 },
  categoryChip: { backgroundColor: '#1e293b', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: '#334155' },
  categoryChipActive: { backgroundColor: '#f59e0b', borderColor: '#f59e0b' },
  categoryChipText: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  categoryChipTextActive: { color: '#0f172a', fontWeight: 'bold' },
  deleteBar: { backgroundColor: '#ef4444', marginHorizontal: 16, marginBottom: 12, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  deleteBarText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  gridContainer: { paddingHorizontal: 10, paddingBottom: 20 },
  card: { flex: 1, backgroundColor: '#1e293b', margin: 6, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#334155' },
  selectedCard: { borderColor: '#f59e0b', borderWidth: 2 },
  cardImage: { width: '100%', height: 160, backgroundColor: '#0f172a' },
  cardInfo: { padding: 10 },
  cardName: { color: '#f8fafc', fontSize: 14, fontWeight: 'bold' },
  cardSub: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  checkbox: { position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.6)', borderWidth: 2, borderColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  checkboxSelected: { backgroundColor: '#f59e0b', borderColor: '#f59e0b' },
  checkmark: { color: '#0f172a', fontWeight: 'bold', fontSize: 14 },
  emptyContainer: { marginTop: 100, alignItems: 'center', paddingHorizontal: 20 },
  emptyText: { color: '#64748b', fontSize: 14, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', backgroundColor: '#1e293b', borderRadius: 16, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  modalCloseButton: { alignSelf: 'flex-end', padding: 4, marginBottom: 8 },
  modalCloseText: { color: '#94a3b8', fontSize: 22, fontWeight: 'bold' },
  enlargedImage: { width: '100%', height: 320, backgroundColor: '#0f172a', borderRadius: 8, marginBottom: 16 },
  modalTitle: { color: '#f8fafc', fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
  modalDetailsBox: { width: '100%', backgroundColor: '#0f172a', borderRadius: 10, padding: 12, gap: 6 },
  modalDetailRow: { color: '#f8fafc', fontSize: 14 },
  modalDetailLabel: { color: '#f59e0b', fontWeight: 'bold' },
});