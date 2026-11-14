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
  ScrollView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

const API_BASE_URL = 'http://100.112.122.109:8000';

export default function App() {
  const [userSession, setUserSession] = useState(null); // { email, firstName, gender }
  const [loadingSession, setLoadingSession] = useState(true);

  // Auth Form States
  const [isRegistering, setIsRegistering] = useState(false);
  const [firstNameInput, setFirstNameInput] = useState('');
  const [lastNameInput, setLastNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [genderInput, setGenderInput] = useState('Male'); // Default registration gender
  const [authLoading, setAuthLoading] = useState(false);

  // Wardrobe States
  const [items, setItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState([]);

  useEffect(() => {
    checkPersistedSession();
  }, []);

  useEffect(() => {
    if (userSession) {
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
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

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
        },
      },
    ]);
  };

  const fetchItems = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/items`, {
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
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission required', 'Camera roll permissions are needed!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const localUri = result.assets[0].uri;
      const filename = localUri.split('/').pop() || `garment_${Date.now()}.jpg`;

      const formData = new FormData();
      formData.append('file', {
        uri: localUri,
        name: filename,
        type: 'image/jpeg',
      });
      // Automatically use the gender saved to the user's profile
      formData.append('gender', userSession.gender);

      try {
        const response = await fetch(`${API_BASE_URL}/api/wardrobe/upload`, {
          method: 'POST',
          headers: {
            'X-User-Id': userSession.email,
            'Content-Type': 'multipart/form-data',
          },
          body: formData,
        });

        if (response.ok) {
          setTimeout(() => {
            fetchItems();
          }, 1000);
        } else {
          Alert.alert('Upload Failed', 'Server rejected the upload.');
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to upload image to Pi backend.');
      }
    }
  };

  const toggleSelectItem = (id) => {
    if (selectedItemIds.includes(id)) {
      setSelectedItemIds(selectedItemIds.filter((item_id) => item_id !== id));
    } else {
      setSelectedItemIds([...selectedItemIds, id]);
    }
  };

  const deleteSelectedItems = async () => {
    if (selectedItemIds.length === 0) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/items/batch-delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userSession.email,
        },
        body: JSON.stringify({ item_ids: selectedItemIds }),
      });

      if (response.ok) {
        setSelectedItemIds([]);
        setIsSelectMode(false);
        fetchItems();
      } else {
        Alert.alert('Error', 'Failed to delete items.');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error during deletion.');
    }
  };

  if (loadingSession) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#f59e0b" />
      </View>
    );
  }

  // --- SIGN IN / REGISTER UI SCREEN ---
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
                    <Text style={[styles.authGenderText, genderInput === 'Male' && styles.authActiveGenderText]}>Male</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.authGenderTab, genderInput === 'Female' && styles.authActiveGenderTab]}
                    onPress={() => setGenderInput('Female')}
                  >
                    <Text style={[styles.authGenderText, genderInput === 'Female' && styles.authActiveGenderText]}>Female</Text>
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

  // --- MAIN WARDROBE DASHBOARD UI (Single Unified View) ---
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

      {/* Action controls (Gender toggle removed from UI) */}
      <View style={styles.controlsRow}>
        <Text style={styles.wardrobeSubtitle}>{userSession.gender}'s Wardrobe Collection</Text>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => {
              setIsSelectMode(!isSelectMode);
              setSelectedItemIds([]);
            }}
          >
            <Text style={styles.secondaryButtonText}>{isSelectMode ? 'Cancel' : 'Select'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.addButton} onPress={pickImageAndUpload}>
            <Text style={styles.addButtonText}>+ Add Photo</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isSelectMode && selectedItemIds.length > 0 && (
        <TouchableOpacity style={styles.deleteBar} onPress={deleteSelectedItems}>
          <Text style={styles.deleteBarText}>Delete Selected ({selectedItemIds.length})</Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={items}
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
              onPress={() => (isSelectMode ? toggleSelectItem(item.id) : null)}
            >
              <Image source={{ uri: `${API_BASE_URL}${item.image_path}` }} style={styles.cardImage} resizeMode="contain" />
              <View style={styles.cardInfo}>
                <Text style={styles.cardName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.cardSub} numberOfLines={1}>
                  {item.sub_type} • {item.color}
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
            <Text style={styles.emptyText}>Your wardrobe is empty. Tap "+ Add Photo" to start!</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  authContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  appTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#f8fafc',
    textAlign: 'center',
    letterSpacing: 1,
  },
  appSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 32,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  label: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 8,
  },
  authGenderContainer: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 2,
  },
  authGenderTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  authActiveGenderTab: {
    backgroundColor: '#f59e0b',
  },
  authGenderText: {
    color: '#94a3b8',
    fontWeight: '600',
  },
  authActiveGenderText: {
    color: '#0f172a',
  },
  input: {
    backgroundColor: '#1e293b',
    color: '#f8fafc',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  primaryButton: {
    backgroundColor: '#f59e0b',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: 'bold',
  },
  switchAuthText: {
    marginTop: 20,
    alignItems: 'center',
  },
  switchTextNormal: {
    color: '#94a3b8',
    fontSize: 14,
  },
  switchTextHighlight: {
    color: '#f59e0b',
    fontWeight: 'bold',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  loggedUserText: {
    fontSize: 13,
    color: '#f59e0b',
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600',
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  wardrobeSubtitle: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButton: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  secondaryButtonText: {
    color: '#f8fafc',
    fontSize: 13,
  },
  addButton: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: 'bold',
  },
  deleteBar: {
    backgroundColor: '#ef4444',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteBarText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  gridContainer: {
    paddingHorizontal: 10,
  },
  card: {
    flex: 1,
    backgroundColor: '#1e293b',
    margin: 6,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
  },
  selectedCard: {
    borderColor: '#f59e0b',
    borderWidth: 2,
  },
  cardImage: {
    width: '100%',
    height: 160,
    backgroundColor: '#0f172a',
  },
  cardInfo: {
    padding: 10,
  },
  cardName: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: 'bold',
  },
  cardSub: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  checkbox: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 2,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  checkmark: {
    color: '#0f172a',
    fontWeight: 'bold',
    fontSize: 14,
  },
  emptyContainer: {
    marginTop: 100,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 14,
    textAlign: 'center',
  },
});