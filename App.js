import React, { useState, useEffect, useRef } from 'react';
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
  Modal,
  Animated
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import {
  API_BASE_URL,
  deleteBatchWardrobeItems,
  suggestWardrobeOutfit,
  updateWardrobeItem,
  sendPasswordResetCode,
  confirmPasswordReset,
  fetchAccountDetails,
  deleteUserAccount,
} from './api';

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

const FEMALE_FOOTWEAR_TYPES = ['Sneakers', 'Sandals', 'Heels', 'Boots'];

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

const FEMALE_MOODS = ['Casual', 'Work', 'Date', 'Cute'];
const MALE_MOODS = ['Casual', 'Work', 'Date'];

function PasswordField({
  value,
  onChangeText,
  placeholder,
  placeholderTextColor = '#888',
  containerStyle,
  inputStyle,
  iconSize = 20,
  resetKey,
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(false);
  }, [resetKey]);

  return (
    <View style={[styles.passwordWrapper, containerStyle]}>
      <TextInput
        style={[styles.passwordTextInput, inputStyle]}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        value={value}
        onChangeText={onChangeText}
      />
      <TouchableOpacity
        onPress={() => setVisible((prev) => !prev)}
        style={styles.eyeButton}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Hide password' : 'Show password'}
      >
        <Ionicons
          name={visible ? 'eye-off-outline' : 'eye-outline'}
          size={iconSize}
          color="#94a3b8"
        />
      </TouchableOpacity>
    </View>
  );
}

export default function App() {
  const [userSession, setUserSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);

  // Auth Form States ('login' | 'register' | 'reset')
  const [authMode, setAuthMode] = useState('login');
  const [firstNameInput, setFirstNameInput] = useState('');
  const [lastNameInput, setLastNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [resetCodeInput, setResetCodeInput] = useState('');
  const [resetCodeSent, setResetCodeSent] = useState(false);
  const [sendingResetCode, setSendingResetCode] = useState(false);
  const [genderInput, setGenderInput] = useState('Male');
  const [authLoading, setAuthLoading] = useState(false);

  // Account Modal States
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountDetails, setAccountDetails] = useState(null);
  const [loadingAccount, setLoadingAccount] = useState(false);
  const [showAccountResetForm, setShowAccountResetForm] = useState(false);
  const [accountResetCodeSent, setAccountResetCodeSent] = useState(false);
  const [sendingAccountCode, setSendingAccountCode] = useState(false);
  const [accountResetCode, setAccountResetCode] = useState('');
  const [newAccountPw, setNewAccountPw] = useState('');
  const [confirmNewAccountPw, setConfirmNewAccountPw] = useState('');
  const [updatingAccountPw, setUpdatingAccountPw] = useState(false);
  const [showDeleteConfirmBox, setShowDeleteConfirmBox] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Main View Tab: 'wardrobe' | 'stylist'
  const [activeTab, setActiveTab] = useState('wardrobe');

  // Wardrobe States
  const [items, setItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [refreshing, setRefreshing] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(null);

  // Outfit Stylist & Location States
  const [selectedMood, setSelectedMood] = useState('Casual');
  const [tempUnit, setTempUnit] = useState('C'); // 'C' or 'F'
  const tempSlideAnim = useRef(new Animated.Value(0)).current;
  const [showLocationDisclaimer, setShowLocationDisclaimer] = useState(false);
  const [pendingMoodForSuggestion, setPendingMoodForSuggestion] = useState(null);
  const [coords, setCoords] = useState(null);
  const [locationDeclined, setLocationDeclined] = useState(false);
  const [loadingOutfit, setLoadingOutfit] = useState(false);
  const [outfitResult, setOutfitResult] = useState(null);

  // Enlarged & Edit Garment Modal States
  const [enlargedItem, setEnlargedItem] = useState(null);
  const [isEditingGarment, setIsEditingGarment] = useState(false);
  const [editCategory, setEditCategory] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editType, setEditType] = useState('');
  const [editBrand, setEditBrand] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const HOST_ROOT = API_BASE_URL.replace('/api', '');

  useEffect(() => {
    checkPersistedSession();
  }, []);

  useEffect(() => {
    if (userSession) {
      setSelectedCategory('All');
      setSelectedMood('Casual');
      setOutfitResult(null);
      fetchItems();
    }
  }, [userSession]);

  const checkPersistedSession = async () => {
    try {
      const [savedSession, savedUnit] = await Promise.all([
        AsyncStorage.getItem('@atelier_session'),
        AsyncStorage.getItem('@atelier_temp_unit'),
      ]);
      if (savedSession) {
        setUserSession(JSON.parse(savedSession));
      }
      if (savedUnit === 'F' || savedUnit === 'C') {
        setTempUnit(savedUnit);
        tempSlideAnim.setValue(savedUnit === 'F' ? 1 : 0);
      }
    } catch (e) {
      console.error('Failed to load session', e);
    } finally {
      setLoadingSession(false);
    }
  };

  const toggleTempUnit = async () => {
    const nextUnit = tempUnit === 'C' ? 'F' : 'C';
    setTempUnit(nextUnit);
    Animated.spring(tempSlideAnim, {
      toValue: nextUnit === 'F' ? 1 : 0,
      useNativeDriver: true,
      friction: 7,
      tension: 90,
    }).start();

    try {
      await AsyncStorage.setItem('@atelier_temp_unit', nextUnit);
    } catch (e) {
      console.warn('Could not save temperature unit preference', e);
    }
  };

  const formatOutdoorTemperature = (weather) => {
    if (!weather) return '';
    if (tempUnit === 'F') {
      const valF =
        weather.temp_f !== undefined && weather.temp_f !== null
          ? weather.temp_f
          : Math.round(((weather.temp_c * 9) / 5 + 32) * 10) / 10;
      return `${valF}°F • ${weather.condition}`;
    }
    return `${weather.temp_c}°C • ${weather.condition}`;
  };

  const handleSendResetCodeFromAuth = async () => {
    if (!emailInput.trim()) {
      Alert.alert('Email Required', 'Please enter your registered email address first.');
      return;
    }

    setSendingResetCode(true);
    try {
      const result = await sendPasswordResetCode(emailInput.trim());
      if (result.status === 'success') {
        setResetCodeSent(true);
        setResetCodeInput('');
        Alert.alert('Code Sent', result.message || 'Check your email for the 6-digit authentication code.');
      } else {
        Alert.alert('Could Not Send Code', result.message || 'Failed to send authentication code.');
      }
    } finally {
      setSendingResetCode(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!emailInput.trim() || !resetCodeInput.trim() || !passwordInput || !confirmPasswordInput) {
      Alert.alert('Missing Fields', 'Please enter your email, the 6-digit code, and your new password.');
      return;
    }
    if (passwordInput !== confirmPasswordInput) {
      Alert.alert('Password Mismatch', 'New password and confirm password do not match.');
      return;
    }

    setAuthLoading(true);
    try {
      const result = await confirmPasswordReset({
        email: emailInput.trim(),
        code: resetCodeInput.trim(),
        newPassword: passwordInput,
      });

      if (result.status === 'success') {
        Alert.alert('Password Reset', result.message || 'Your password has been updated.');
        setPasswordInput('');
        setConfirmPasswordInput('');
        setResetCodeInput('');
        setResetCodeSent(false);
        setAuthMode('login');
      } else {
        Alert.alert('Reset Failed', result.message || 'Could not reset password.');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAuth = async () => {
    if (authMode === 'reset') {
      if (!resetCodeSent) {
        handleSendResetCodeFromAuth();
      } else {
        handlePasswordReset();
      }
      return;
    }

    if (!emailInput.trim() || !passwordInput.trim()) {
      Alert.alert('Error', 'Please enter your email and password.');
      return;
    }
    if (authMode === 'register' && !firstNameInput.trim()) {
      Alert.alert('Error', 'Please enter your first name.');
      return;
    }

    setAuthLoading(true);
    const endpoint = authMode === 'register' ? '/api/register' : '/api/login';
    const payload =
      authMode === 'register'
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
          lastName: data.last_name || '',
          gender: data.gender,
        };
        await AsyncStorage.setItem('@atelier_session', JSON.stringify(sessionData));
        setUserSession(sessionData);
        setEmailInput('');
        setPasswordInput('');
        setConfirmPasswordInput('');
        setResetCodeInput('');
        setResetCodeSent(false);
        setFirstNameInput('');
        setLastNameInput('');
        setAuthMode('login');
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
          setShowAccountModal(false);
          setUserSession(null);
          setItems([]);
          setSelectedCategory('All');
          setIsSelectMode(false);
          setSelectedItemIds([]);
          setOutfitResult(null);
        },
      },
    ]);
  };

  const openAccountModal = async () => {
    setShowAccountModal(true);
    setShowAccountResetForm(false);
    setAccountResetCodeSent(false);
    setAccountResetCode('');
    setNewAccountPw('');
    setConfirmNewAccountPw('');
    setShowDeleteConfirmBox(false);
    setDeleteConfirmText('');
    setLoadingAccount(true);

    try {
      const res = await fetchAccountDetails(userSession.email);
      if (res.status === 'success' && res.account) {
        setAccountDetails(res.account);
      }
    } finally {
      setLoadingAccount(false);
    }
  };

  const closeAccountModal = () => {
    setShowAccountModal(false);
    setShowAccountResetForm(false);
    setAccountResetCodeSent(false);
    setShowDeleteConfirmBox(false);
    setDeleteConfirmText('');
  };

  const handleSendAccountResetCode = async () => {
    setSendingAccountCode(true);
    try {
      const res = await sendPasswordResetCode(userSession.email);
      if (res.status === 'success') {
        setAccountResetCodeSent(true);
        setAccountResetCode('');
        Alert.alert('Code Sent', res.message || `Authentication code sent to ${userSession.email}.`);
      } else {
        Alert.alert('Could Not Send Code', res.message || 'Failed to send authentication code.');
      }
    } finally {
      setSendingAccountCode(false);
    }
  };

  const handleInAccountPasswordUpdate = async () => {
    if (!accountResetCode.trim() || !newAccountPw || !confirmNewAccountPw) {
      Alert.alert('Missing Fields', 'Please enter the 6-digit code and your new password fields.');
      return;
    }
    if (newAccountPw !== confirmNewAccountPw) {
      Alert.alert('Password Mismatch', 'New password and confirm password do not match.');
      return;
    }

    setUpdatingAccountPw(true);
    try {
      const res = await confirmPasswordReset({
        email: userSession.email,
        code: accountResetCode.trim(),
        newPassword: newAccountPw,
      });

      if (res.status === 'success') {
        Alert.alert('Password Updated', res.message || 'Your password has been updated.');
        setAccountResetCode('');
        setAccountResetCodeSent(false);
        setNewAccountPw('');
        setConfirmNewAccountPw('');
        setShowAccountResetForm(false);
      } else {
        Alert.alert('Update Failed', res.message || 'Could not update password.');
      }
    } finally {
      setUpdatingAccountPw(false);
    }
  };

  const promptAccountDeletionFlow = () => {
    Alert.alert(
      'Delete Account?',
      'This will permanently delete your account, your profile, and every uploaded garment image in your wardrobe. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            setShowAccountResetForm(false);
            setDeleteConfirmText('');
            setShowDeleteConfirmBox(true);
          },
        },
      ]
    );
  };

  const confirmAndDeleteAccount = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') {
      Alert.alert('Confirmation Required', 'Please type DELETE in the box to confirm account deletion.');
      return;
    }

    Alert.alert(
      'Final Confirmation',
      `Are you completely sure you want to permanently delete ${userSession.email}?`,
      [
        { text: 'Keep Account', style: 'cancel' },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: async () => {
            setDeletingAccount(true);
            try {
              const res = await deleteUserAccount(userSession.email);
              if (res.status === 'success') {
                await AsyncStorage.removeItem('@atelier_session');
                setShowAccountModal(false);
                setShowDeleteConfirmBox(false);
                setDeleteConfirmText('');
                setAccountDetails(null);
                setEnlargedItem(null);
                setItems([]);
                setOutfitResult(null);
                setUserSession(null);
                Alert.alert('Account Deleted', 'Your account and wardrobe data have been permanently removed.');
              } else {
                Alert.alert('Deletion Failed', res.message || 'Could not delete account.');
              }
            } finally {
              setDeletingAccount(false);
            }
          },
        },
      ]
    );
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

  const openGarmentModal = (item) => {
    setEnlargedItem(item);
    setIsEditingGarment(false);
    setEditCategory(item.category || '');
    setEditColor(item.color || '');
    setEditType(item.type || item.sub_type || '');
    setEditBrand(item.brand || '');
  };

  const closeGarmentModal = () => {
    setEnlargedItem(null);
    setIsEditingGarment(false);
  };

  const handleSaveGarmentEdit = async () => {
    if (!enlargedItem) return;
    if (!editColor.trim() || !editType.trim() || !editCategory.trim()) {
      Alert.alert('Missing Fields', 'Please provide a category, color, and garment type.');
      return;
    }

    setSavingEdit(true);
    try {
      const result = await updateWardrobeItem(
        enlargedItem.id,
        {
          category: editCategory.trim(),
          color: editColor.trim(),
          type: editType.trim(),
          brand: editBrand.trim(),
        },
        userSession.email
      );

      if (result.status === 'success' && result.item) {
        const updated = result.item;
        setItems((prev) => prev.map((it) => (it.id === updated.id ? { ...it, ...updated } : it)));
        setEnlargedItem((prev) => (prev ? { ...prev, ...updated } : updated));
        setOutfitResult((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            items: prev.items.map((it) => (it.id === updated.id ? { ...it, ...updated } : it)),
          };
        });
        setIsEditingGarment(false);
      } else {
        Alert.alert('Update Failed', result.message || 'Could not update garment details.');
      }
    } finally {
      setSavingEdit(false);
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

  const executeOutfitSuggestion = async (moodToUse, activeCoords, excludeIds = []) => {
    setLoadingOutfit(true);
    try {
      const result = await suggestWardrobeOutfit(
        {
          mood: moodToUse,
          latitude: activeCoords ? activeCoords.latitude : null,
          longitude: activeCoords ? activeCoords.longitude : null,
          gender: userSession.gender,
          tempUnit,
          excludeItemIds: excludeIds,
        },
        userSession.email
      );

      if (result.status === 'success') {
        setOutfitResult(result);
      } else {
        Alert.alert('Outfit Suggestion', result.message || 'Could not generate an outfit.');
      }
    } finally {
      setLoadingOutfit(false);
    }
  };

  const handleRequestOutfit = async (moodToUse = selectedMood, excludeIds = []) => {
    setSelectedMood(moodToUse);

    if (coords) {
      executeOutfitSuggestion(moodToUse, coords, excludeIds);
      return;
    }

    try {
      const existingPerm = await Location.getForegroundPermissionsAsync();
      if (existingPerm.status === 'granted') {
        setLoadingOutfit(true);
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const freshCoords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        setCoords(freshCoords);
        setLocationDeclined(false);
        executeOutfitSuggestion(moodToUse, freshCoords, excludeIds);
        return;
      }
    } catch (e) {
      console.warn('Permission check error:', e);
    }

    if (locationDeclined) {
      executeOutfitSuggestion(moodToUse, null, excludeIds);
      return;
    }

    setPendingMoodForSuggestion(moodToUse);
    setShowLocationDisclaimer(true);
  };

  const handleAcceptLocationDisclaimer = async () => {
    setShowLocationDisclaimer(false);
    const moodToUse = pendingMoodForSuggestion || selectedMood;
    setLoadingOutfit(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const freshCoords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        setCoords(freshCoords);
        setLocationDeclined(false);
        executeOutfitSuggestion(moodToUse, freshCoords);
      } else {
        setLocationDeclined(true);
        Alert.alert(
          'Location Off',
          'Generating outfit suggestions based on your mood without local outdoor temperature.'
        );
        executeOutfitSuggestion(moodToUse, null);
      }
    } catch (err) {
      setLocationDeclined(true);
      executeOutfitSuggestion(moodToUse, null);
    }
  };

  const handleDeclineLocationDisclaimer = () => {
    setShowLocationDisclaimer(false);
    setLocationDeclined(true);
    const moodToUse = pendingMoodForSuggestion || selectedMood;
    executeOutfitSuggestion(moodToUse, null);
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
    const isRegister = authMode === 'register';
    const isReset = authMode === 'reset';

    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.authContainer} keyboardShouldPersistTaps="handled">
            <Text style={styles.appTitle}>Atelier</Text>
            <Text style={styles.appSubtitle}>
              {isReset ? 'Reset Account Password' : 'Luxury Digital Wardrobe'}
            </Text>

            {isReset && (
              <Text style={styles.resetHelperText}>
                Enter your registered email address to receive a 6-digit authentication code.
              </Text>
            )}

            <TextInput
              style={styles.input}
              placeholder="Email Address"
              placeholderTextColor="#888"
              autoCapitalize="none"
              keyboardType="email-address"
              value={emailInput}
              onChangeText={(text) => {
                setEmailInput(text);
                if (isReset && resetCodeSent) {
                  setResetCodeSent(false);
                  setResetCodeInput('');
                }
              }}
            />

            {isRegister && (
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

            {isReset && resetCodeSent && (
              <>
                <View style={styles.codeSentBanner}>
                  <Text style={styles.codeSentBannerText}>
                    Authentication code sent to {emailInput.trim().toLowerCase()}
                  </Text>
                  <TouchableOpacity
                    onPress={handleSendResetCodeFromAuth}
                    disabled={sendingResetCode}
                  >
                    <Text style={styles.resendCodeLink}>
                      {sendingResetCode ? 'Sending...' : 'Resend Code'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={styles.input}
                  placeholder="6-Digit Authentication Code"
                  placeholderTextColor="#888"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={resetCodeInput}
                  onChangeText={setResetCodeInput}
                />

                <PasswordField
                  placeholder="New Password"
                  placeholderTextColor="#888"
                  value={passwordInput}
                  onChangeText={setPasswordInput}
                  resetKey={`${authMode}-${resetCodeSent}`}
                />

                <PasswordField
                  placeholder="Confirm New Password"
                  placeholderTextColor="#888"
                  value={confirmPasswordInput}
                  onChangeText={setConfirmPasswordInput}
                  resetKey={`${authMode}-${resetCodeSent}`}
                />
              </>
            )}

            {!isReset && (
              <PasswordField
                placeholder="Password"
                placeholderTextColor="#888"
                value={passwordInput}
                onChangeText={setPasswordInput}
                resetKey={authMode}
              />
            )}

            {authMode === 'login' && (
              <TouchableOpacity
                onPress={() => {
                  setPasswordInput('');
                  setConfirmPasswordInput('');
                  setResetCodeInput('');
                  setResetCodeSent(false);
                  setAuthMode('reset');
                }}
                style={styles.forgotPasswordRow}
              >
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleAuth}
              disabled={authLoading || sendingResetCode}
            >
              {authLoading || sendingResetCode ? (
                <ActivityIndicator color="#0f172a" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {isReset
                    ? resetCodeSent
                      ? 'Verify & Update Password'
                      : 'Send Authentication Code'
                    : isRegister
                    ? 'Create Account'
                    : 'Sign In'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setPasswordInput('');
                setConfirmPasswordInput('');
                setResetCodeInput('');
                setResetCodeSent(false);
                setAuthMode(authMode === 'login' ? 'register' : 'login');
              }}
              style={styles.switchAuthText}
            >
              <Text style={styles.switchTextNormal}>
                {isReset
                  ? 'Remembered your password? '
                  : isRegister
                  ? 'Already have an account? '
                  : "Don't have an account? "}
                <Text style={styles.switchTextHighlight}>
                  {isReset || isRegister ? 'Sign In' : 'Register'}
                </Text>
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  const isFemale = userSession.gender?.toLowerCase() === 'female';
  const availableCategories = isFemale ? FEMALE_CATEGORIES : MALE_CATEGORIES;
  const editableCategories = availableCategories.filter((c) => c !== 'All');
  const availableMoods = isFemale ? FEMALE_MOODS : MALE_MOODS;

  const filteredItems =
    selectedCategory === 'All'
      ? items
      : items.filter((item) => item.category === selectedCategory);

  const thumbTranslateX = tempSlideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 35],
  });

  const displayFirstName = accountDetails?.first_name ?? userSession.firstName;
  const displayLastName = accountDetails?.last_name ?? userSession.lastName ?? '';
  const displayFullName = [displayFirstName, displayLastName].filter(Boolean).join(' ');
  const displayEmail = accountDetails?.email ?? userSession.email;
  const displayGender = accountDetails?.gender ?? userSession.gender;
  const displayGarmentCount =
    accountDetails?.garment_count !== undefined ? accountDetails.garment_count : items.length;
  const displayMemberSince = accountDetails?.created_at
    ? accountDetails.created_at.split(' ')[0]
    : null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerTitle}>Atelier</Text>
          <Text style={styles.loggedUserText}>Welcome back, {userSession.firstName}!</Text>
        </View>
        <View style={styles.headerActionsGroup}>
          <TouchableOpacity onPress={openAccountModal} style={styles.accountButton}>
            <Text style={styles.accountButtonText}>Account</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Mode Switcher: Wardrobe vs Outfit Stylist */}
      <View style={styles.modeSwitcherContainer}>
        <TouchableOpacity
          style={[styles.modeTab, activeTab === 'wardrobe' && styles.modeTabActive]}
          onPress={() => setActiveTab('wardrobe')}
        >
          <Text style={[styles.modeTabText, activeTab === 'wardrobe' && styles.modeTabTextActive]}>
            Wardrobe ({items.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeTab, activeTab === 'stylist' && styles.modeTabActive]}
          onPress={() => {
            setActiveTab('stylist');
            if (!outfitResult && items.length >= 2) {
              handleRequestOutfit(selectedMood);
            }
          }}
        >
          <Text style={[styles.modeTabText, activeTab === 'stylist' && styles.modeTabTextActive]}>
            Outfit Stylist
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'wardrobe' ? (
        <>
          <View style={styles.controlsRow}>
            <Text style={styles.wardrobeSubtitle}>
              {isSelectMode ? `${selectedItemIds.length} Selected` : `${userSession.gender}'s Wardrobe`}
            </Text>

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
                      openGarmentModal(item);
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
        </>
      ) : (
        <ScrollView contentContainerStyle={styles.stylistScrollContainer}>
          <View style={styles.moodSectionCard}>
            <View style={styles.moodHeaderRow}>
              <Text style={styles.sectionHeading}>Pick a Mood:</Text>

              <View style={styles.weatherControlsGroup}>
                {outfitResult?.weather ? (
                  <View style={styles.weatherBadge}>
                    <Text style={styles.weatherBadgeText}>
                      {formatOutdoorTemperature(outfitResult.weather)}
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.weatherEnablePill}
                    onPress={() => {
                      setLocationDeclined(false);
                      setPendingMoodForSuggestion(selectedMood);
                      setShowLocationDisclaimer(true);
                    }}
                  >
                    <Text style={styles.weatherEnableText}>
                      {coords ? 'GPS Active' : 'Enable GPS'}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* °C / °F Sliding Toggle Switch */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={toggleTempUnit}
                  style={styles.unitSliderTrack}
                  accessibilityRole="switch"
                  accessibilityLabel="Temperature unit switch"
                >
                  <Animated.View
                    style={[
                      styles.unitSliderThumb,
                      { transform: [{ translateX: thumbTranslateX }] },
                    ]}
                  />
                  <View style={styles.unitSliderLabelsRow}>
                    <Text style={[styles.unitSliderText, tempUnit === 'C' && styles.unitSliderTextActive]}>
                      °C
                    </Text>
                    <Text style={[styles.unitSliderText, tempUnit === 'F' && styles.unitSliderTextActive]}>
                      °F
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.moodChipsRow}>
              {availableMoods.map((mood) => {
                const isSelected = selectedMood === mood;
                return (
                  <TouchableOpacity
                    key={mood}
                    style={[styles.moodChip, isSelected && styles.moodChipActive]}
                    onPress={() => handleRequestOutfit(mood)}
                    disabled={loadingOutfit}
                  >
                    <Text style={[styles.moodChipText, isSelected && styles.moodChipTextActive]}>
                      {mood}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {loadingOutfit ? (
            <View style={styles.stylistLoadingBox}>
              <ActivityIndicator size="large" color="#f59e0b" />
              <Text style={styles.stylistLoadingText}>
                Curating a Pinterest-inspired {selectedMood.toLowerCase()} outfit for today's weather...
              </Text>
            </View>
          ) : outfitResult ? (
            <View style={styles.outfitCard}>
              <View style={styles.outfitTitleRow}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.outfitMoodTag}>
                    {outfitResult.mood.toUpperCase()}
                    {outfitResult.aesthetic_vibe ? ` • ${outfitResult.aesthetic_vibe.toUpperCase()}` : ''}
                  </Text>
                  <Text style={styles.outfitTitle}>{outfitResult.outfit_title}</Text>
                </View>
                <TouchableOpacity
                  style={styles.shuffleButton}
                  onPress={() =>
                    handleRequestOutfit(
                      selectedMood,
                      outfitResult.items.map((i) => i.id)
                    )
                  }
                >
                  <Text style={styles.shuffleButtonText}>Shuffle</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.stylistNote}>{outfitResult.stylist_note}</Text>

              <View style={styles.outfitGrid}>
                {outfitResult.items.map((garment) => (
                  <TouchableOpacity
                    key={`${garment.slot || garment.category}-${garment.id}`}
                    style={styles.outfitPieceCard}
                    activeOpacity={0.85}
                    onPress={() => openGarmentModal(garment)}
                  >
                    <Image
                      source={{ uri: `${HOST_ROOT}${garment.image_path}` }}
                      style={styles.outfitPieceImage}
                      resizeMode="contain"
                    />
                    <View style={styles.outfitPieceInfo}>
                      <Text style={styles.outfitPieceCategory}>
                        {garment.slot ? `${garment.slot} • ${garment.category}` : garment.category}
                      </Text>
                      <Text style={styles.outfitPieceName} numberOfLines={1}>
                        {garment.name}
                      </Text>
                      <Text style={styles.outfitPieceSub} numberOfLines={1}>
                        {formatCardSubtitle(garment)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                Select a mood above to get weather-matched, Pinterest-inspired outfit recommendations from your wardrobe.
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Account Details, Email-Verified Password Reset & Delete Account Modal */}
      <Modal
        visible={showAccountModal}
        transparent={true}
        animationType="fade"
        onRequestClose={closeAccountModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <ScrollView
            contentContainerStyle={styles.modalScrollWrapper}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalContent}>
              <View style={styles.modalTopActionsRow}>
                <Text style={styles.accountModalHeaderTitle}>Account Details</Text>
                <TouchableOpacity style={styles.modalCloseButton} onPress={closeAccountModal}>
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              {loadingAccount && !accountDetails ? (
                <ActivityIndicator size="small" color="#f59e0b" style={{ marginVertical: 20 }} />
              ) : (
                <View style={styles.modalDetailsBox}>
                  <Text style={styles.modalDetailRow}>
                    <Text style={styles.modalDetailLabel}>Name: </Text>
                    {displayFullName || 'Member'}
                  </Text>
                  <Text style={styles.modalDetailRow}>
                    <Text style={styles.modalDetailLabel}>Email: </Text>
                    {displayEmail}
                  </Text>
                  <Text style={styles.modalDetailRow}>
                    <Text style={styles.modalDetailLabel}>Wardrobe Type: </Text>
                    {displayGender}
                  </Text>
                  <Text style={styles.modalDetailRow}>
                    <Text style={styles.modalDetailLabel}>Garments Saved: </Text>
                    {displayGarmentCount}
                  </Text>
                  {displayMemberSince && (
                    <Text style={styles.modalDetailRow}>
                      <Text style={styles.modalDetailLabel}>Member Since: </Text>
                      {displayMemberSince}
                    </Text>
                  )}
                </View>
              )}

              {/* Reset Password Section inside Account Details (via Email Authentication Code) */}
              <View style={styles.accountSectionDivider} />
              <TouchableOpacity
                style={styles.accountActionRowBtn}
                onPress={() => {
                  setShowDeleteConfirmBox(false);
                  setShowAccountResetForm((prev) => !prev);
                }}
              >
                <Text style={styles.accountActionRowBtnText}>
                  {showAccountResetForm ? 'Cancel Password Reset' : 'Reset Password'}
                </Text>
                <Text style={styles.accountActionChevron}>{showAccountResetForm ? '▲' : '▼'}</Text>
              </TouchableOpacity>

              {showAccountResetForm && (
                <View style={styles.accountSubCard}>
                  <Text style={styles.accountResetNote}>
                    We will send a 6-digit authentication code to{' '}
                    <Text style={{ color: '#f8fafc', fontWeight: 'bold' }}>{displayEmail}</Text> to verify your reset.
                  </Text>

                  {!accountResetCodeSent ? (
                    <TouchableOpacity
                      style={styles.saveEditButton}
                      onPress={handleSendAccountResetCode}
                      disabled={sendingAccountCode}
                    >
                      {sendingAccountCode ? (
                        <ActivityIndicator color="#0f172a" />
                      ) : (
                        <Text style={styles.saveEditButtonText}>Send Authentication Code</Text>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <>
                      <View style={styles.codeSentBanner}>
                        <Text style={styles.codeSentBannerText}>Code sent! Check your inbox.</Text>
                        <TouchableOpacity
                          onPress={handleSendAccountResetCode}
                          disabled={sendingAccountCode}
                        >
                          <Text style={styles.resendCodeLink}>
                            {sendingAccountCode ? 'Sending...' : 'Resend'}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      <Text style={styles.editFieldLabel}>6-Digit Authentication Code</Text>
                      <TextInput
                        style={styles.editInput}
                        placeholder="Enter 6-digit code"
                        placeholderTextColor="#64748b"
                        keyboardType="number-pad"
                        maxLength={6}
                        value={accountResetCode}
                        onChangeText={setAccountResetCode}
                      />

                      <Text style={styles.editFieldLabel}>New Password</Text>
                      <PasswordField
                        placeholder="Enter new password"
                        placeholderTextColor="#64748b"
                        containerStyle={styles.editPasswordWrapper}
                        inputStyle={styles.editPasswordTextInput}
                        iconSize={18}
                        value={newAccountPw}
                        onChangeText={setNewAccountPw}
                        resetKey={`${showAccountModal}-${showAccountResetForm}`}
                      />

                      <Text style={styles.editFieldLabel}>Confirm New Password</Text>
                      <PasswordField
                        placeholder="Re-enter new password"
                        placeholderTextColor="#64748b"
                        containerStyle={styles.editPasswordWrapper}
                        inputStyle={styles.editPasswordTextInput}
                        iconSize={18}
                        value={confirmNewAccountPw}
                        onChangeText={setConfirmNewAccountPw}
                        resetKey={`${showAccountModal}-${showAccountResetForm}`}
                      />

                      <TouchableOpacity
                        style={styles.saveEditButton}
                        onPress={handleInAccountPasswordUpdate}
                        disabled={updatingAccountPw}
                      >
                        {updatingAccountPw ? (
                          <ActivityIndicator color="#0f172a" />
                        ) : (
                          <Text style={styles.saveEditButtonText}>Verify & Update Password</Text>
                        )}
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}

              {/* Delete Account Section with Multi-Step Prompts */}
              <View style={styles.accountSectionDivider} />
              {!showDeleteConfirmBox ? (
                <TouchableOpacity
                  style={styles.deleteAccountTriggerBtn}
                  onPress={promptAccountDeletionFlow}
                >
                  <Text style={styles.deleteAccountTriggerText}>Delete Account</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.dangerConfirmBox}>
                  <Text style={styles.dangerConfirmTitle}>Confirm Permanent Deletion</Text>
                  <Text style={styles.dangerConfirmBody}>
                    Type <Text style={{ fontWeight: 'bold', color: '#f8fafc' }}>DELETE</Text> below to confirm removing your account and all {displayGarmentCount} garment(s).
                  </Text>
                  <TextInput
                    style={styles.dangerConfirmInput}
                    placeholder="Type DELETE"
                    placeholderTextColor="#64748b"
                    autoCapitalize="characters"
                    value={deleteConfirmText}
                    onChangeText={setDeleteConfirmText}
                  />
                  <View style={styles.dangerActionsRow}>
                    <TouchableOpacity
                      style={styles.dangerCancelBtn}
                      onPress={() => {
                        setShowDeleteConfirmBox(false);
                        setDeleteConfirmText('');
                      }}
                    >
                      <Text style={styles.dangerCancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.dangerSubmitBtn,
                        deleteConfirmText.trim().toUpperCase() !== 'DELETE' && { opacity: 0.5 },
                      ]}
                      onPress={confirmAndDeleteAccount}
                      disabled={deletingAccount}
                    >
                      {deletingAccount ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.dangerSubmitBtnText}>Permanently Delete</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* GPS Location Disclosure Disclaimer Modal */}
      <Modal
        visible={showLocationDisclaimer}
        transparent={true}
        animationType="fade"
        onRequestClose={handleDeclineLocationDisclaimer}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.disclaimerTitle}>Location Access for Weather Styling</Text>
            <Text style={styles.disclaimerBody}>
              Atelier requests access to your device's GPS location solely to check the current outside
              temperature and weather conditions in your area.
            </Text>
            <Text style={styles.disclaimerBody}>
              This allows us to recommend weather-appropriate layers and outfits from your wardrobe. Your
              GPS coordinates are never stored on our server or shared with third parties.
            </Text>

            <View style={styles.disclaimerButtonsRow}>
              <TouchableOpacity
                style={styles.disclaimerSecondaryBtn}
                onPress={handleDeclineLocationDisclaimer}
              >
                <Text style={styles.disclaimerSecondaryText}>Not Now</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.disclaimerPrimaryBtn}
                onPress={handleAcceptLocationDisclaimer}
              >
                <Text style={styles.disclaimerPrimaryText}>Allow Location</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Enlarged Garment Details & Edit Modal */}
      <Modal
        visible={enlargedItem !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={closeGarmentModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <ScrollView
            contentContainerStyle={styles.modalScrollWrapper}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalContent}>
              <View style={styles.modalTopActionsRow}>
                {enlargedItem && enlargedItem.category !== 'Processing' ? (
                  <TouchableOpacity
                    style={[styles.modalEditButton, isEditingGarment && styles.modalEditButtonActive]}
                    onPress={() => {
                      if (isEditingGarment) {
                        setIsEditingGarment(false);
                      } else {
                        setEditCategory(enlargedItem.category || editableCategories[0]);
                        setEditColor(enlargedItem.color || '');
                        setEditType(enlargedItem.type || enlargedItem.sub_type || '');
                        setEditBrand(enlargedItem.brand || '');
                        setIsEditingGarment(true);
                      }
                    }}
                  >
                    <Text
                      style={[
                        styles.modalEditButtonText,
                        isEditingGarment && styles.modalEditButtonTextActive,
                      ]}
                    >
                      {isEditingGarment ? 'Cancel Edit' : 'Edit Details'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View />
                )}

                <TouchableOpacity style={styles.modalCloseButton} onPress={closeGarmentModal}>
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              {enlargedItem && (
                <>
                  <Image
                    source={{ uri: `${HOST_ROOT}${enlargedItem.image_path}` }}
                    style={[styles.enlargedImage, isEditingGarment && { height: 200 }]}
                    resizeMode="contain"
                  />

                  {!isEditingGarment ? (
                    <>
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
                  ) : (
                    <View style={styles.editFormContainer}>
                      <Text style={styles.editFieldLabel}>Category</Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.editCategoryScroll}
                      >
                        {editableCategories.map((cat) => {
                          const active = editCategory === cat;
                          return (
                            <TouchableOpacity
                              key={cat}
                              style={[styles.editCatChip, active && styles.editCatChipActive]}
                              onPress={() => {
                                setEditCategory(cat);
                                if (
                                  isFemale &&
                                  cat === 'Footwear' &&
                                  !FEMALE_FOOTWEAR_TYPES.includes(editType)
                                ) {
                                  setEditType('Sneakers');
                                }
                              }}
                            >
                              <Text
                                style={[
                                  styles.editCatChipText,
                                  active && styles.editCatChipTextActive,
                                ]}
                              >
                                {cat}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>

                      <Text style={styles.editFieldLabel}>Color</Text>
                      <TextInput
                        style={styles.editInput}
                        value={editColor}
                        onChangeText={setEditColor}
                        placeholder="e.g. Navy Blue, Cream, Charcoal"
                        placeholderTextColor="#64748b"
                      />

                      <Text style={styles.editFieldLabel}>Type</Text>
                      {isFemale && editCategory === 'Footwear' ? (
                        <View style={styles.footwearOptionsRow}>
                          {FEMALE_FOOTWEAR_TYPES.map((fw) => {
                            const active = editType === fw;
                            return (
                              <TouchableOpacity
                                key={fw}
                                style={[styles.editCatChip, active && styles.editCatChipActive]}
                                onPress={() => setEditType(fw)}
                              >
                                <Text
                                  style={[
                                    styles.editCatChipText,
                                    active && styles.editCatChipTextActive,
                                  ]}
                                >
                                  {fw}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      ) : (
                        <TextInput
                          style={styles.editInput}
                          value={editType}
                          onChangeText={setEditType}
                          placeholder="e.g. Oversized Blazer, Crewneck T-Shirt"
                          placeholderTextColor="#64748b"
                        />
                      )}

                      <Text style={styles.editFieldLabel}>Brand (Optional)</Text>
                      <TextInput
                        style={styles.editInput}
                        value={editBrand}
                        onChangeText={setEditBrand}
                        placeholder="Leave blank if unbranded"
                        placeholderTextColor="#64748b"
                      />

                      <TouchableOpacity
                        style={styles.saveEditButton}
                        onPress={handleSaveGarmentEdit}
                        disabled={savingEdit}
                      >
                        {savingEdit ? (
                          <ActivityIndicator color="#0f172a" />
                        ) : (
                          <Text style={styles.saveEditButtonText}>Save Changes</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centerContainer: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: '#0f172a' },
  authContainer: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  appTitle: { fontSize: 36, fontWeight: 'bold', color: '#f8fafc', textAlign: 'center', letterSpacing: 1 },
  appSubtitle: { fontSize: 14, color: '#94a3b8', textAlign: 'center', marginBottom: 24, letterSpacing: 2, textTransform: 'uppercase' },
  resetHelperText: { color: '#cbd5e1', fontSize: 13, lineHeight: 19, textAlign: 'center', marginBottom: 20 },
  label: { color: '#94a3b8', fontSize: 14, marginBottom: 8 },
  authGenderContainer: { flexDirection: 'row', backgroundColor: '#1e293b', borderRadius: 8, marginBottom: 16, borderWidth: 1, borderColor: '#334155', padding: 2 },
  authGenderTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 6 },
  authActiveGenderTab: { backgroundColor: '#f59e0b' },
  authGenderText: { color: '#94a3b8', fontWeight: '600' },
  authActiveGenderText: { color: '#0f172a' },
  input: { backgroundColor: '#1e293b', color: '#f8fafc', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 8, fontSize: 16, marginBottom: 16, borderWidth: 1, borderColor: '#334155' },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  passwordTextInput: {
    flex: 1,
    color: '#f8fafc',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  eyeButton: {
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editPasswordWrapper: {
    backgroundColor: '#0f172a',
    marginBottom: 0,
    borderColor: '#334155',
  },
  editPasswordTextInput: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  codeSentBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(245, 158, 11, 0.12)', borderWidth: 1, borderColor: '#f59e0b', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14, gap: 8 },
  codeSentBannerText: { color: '#fbbf24', fontSize: 12, flex: 1 },
  resendCodeLink: { color: '#f59e0b', fontSize: 12, fontWeight: 'bold', textDecorationLine: 'underline' },
  forgotPasswordRow: { alignSelf: 'flex-end', marginTop: -8, marginBottom: 16 },
  forgotPasswordText: { color: '#f59e0b', fontSize: 13, fontWeight: '600' },
  primaryButton: { backgroundColor: '#f59e0b', paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 4 },
  primaryButtonText: { color: '#0f172a', fontSize: 16, fontWeight: 'bold' },
  switchAuthText: { marginTop: 20, alignItems: 'center' },
  switchTextNormal: { color: '#94a3b8', fontSize: 14 },
  switchTextHighlight: { color: '#f59e0b', fontWeight: 'bold' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#f8fafc' },
  loggedUserText: { fontSize: 13, color: '#f59e0b', fontWeight: '600' },
  headerActionsGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  accountButton: { backgroundColor: '#1e293b', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#f59e0b' },
  accountButtonText: { color: '#f59e0b', fontSize: 12, fontWeight: '600' },
  logoutButton: { backgroundColor: '#1e293b', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: '#334155' },
  logoutText: { color: '#ef4444', fontSize: 12, fontWeight: '600' },
  modeSwitcherContainer: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, backgroundColor: '#1e293b', borderRadius: 10, padding: 3, borderWidth: 1, borderColor: '#334155' },
  modeTab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  modeTabActive: { backgroundColor: '#f59e0b' },
  modeTabText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  modeTabTextActive: { color: '#0f172a', fontWeight: 'bold' },
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
  cardImage: { width: '100%', height: 160, backgroundColor: '#cbd5e1' },
  cardInfo: { padding: 10 },
  cardName: { color: '#f8fafc', fontSize: 14, fontWeight: 'bold' },
  cardSub: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  checkbox: { position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.6)', borderWidth: 2, borderColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  checkboxSelected: { backgroundColor: '#f59e0b', borderColor: '#f59e0b' },
  checkmark: { color: '#0f172a', fontWeight: 'bold', fontSize: 14 },
  emptyContainer: { marginTop: 80, alignItems: 'center', paddingHorizontal: 20 },
  emptyText: { color: '#64748b', fontSize: 14, textAlign: 'center' },
  stylistScrollContainer: { paddingHorizontal: 16, paddingBottom: 30 },
  moodSectionCard: { backgroundColor: '#1e293b', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#334155', marginBottom: 14 },
  moodHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8 },
  sectionHeading: { color: '#f8fafc', fontSize: 16, fontWeight: 'bold' },
  weatherControlsGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  weatherBadge: { backgroundColor: '#0f172a', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1, borderColor: '#f59e0b' },
  weatherBadgeText: { color: '#f59e0b', fontSize: 11, fontWeight: 'bold' },
  weatherEnablePill: { backgroundColor: '#0f172a', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1, borderColor: '#334155' },
  weatherEnableText: { color: '#94a3b8', fontSize: 11, fontWeight: '600' },
  unitSliderTrack: {
    width: 76,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    padding: 2,
    justifyContent: 'center',
  },
  unitSliderThumb: {
    position: 'absolute',
    left: 2,
    width: 35,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#f59e0b',
  },
  unitSliderLabelsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  unitSliderText: {
    width: 35,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: 'bold',
    color: '#94a3b8',
  },
  unitSliderTextActive: {
    color: '#0f172a',
  },
  moodChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  moodChip: { backgroundColor: '#0f172a', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: '#334155' },
  moodChipActive: { backgroundColor: '#f59e0b', borderColor: '#f59e0b' },
  moodChipText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
  moodChipTextActive: { color: '#0f172a', fontWeight: 'bold' },
  stylistLoadingBox: { backgroundColor: '#1e293b', borderRadius: 14, padding: 30, alignItems: 'center', borderWidth: 1, borderColor: '#334155', gap: 12 },
  stylistLoadingText: { color: '#94a3b8', fontSize: 13, textAlign: 'center' },
  outfitCard: { backgroundColor: '#1e293b', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#334155' },
  outfitTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  outfitMoodTag: { color: '#f59e0b', fontSize: 11, fontWeight: 'bold', letterSpacing: 1, marginBottom: 2 },
  outfitTitle: { color: '#f8fafc', fontSize: 20, fontWeight: 'bold' },
  shuffleButton: { backgroundColor: '#0f172a', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: '#f59e0b' },
  shuffleButtonText: { color: '#f59e0b', fontSize: 12, fontWeight: 'bold' },
  stylistNote: { color: '#cbd5e1', fontSize: 13, lineHeight: 19, marginBottom: 14 },
  outfitGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  outfitPieceCard: { width: '48%', backgroundColor: '#0f172a', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#334155', marginBottom: 12 },
  outfitPieceImage: { width: '100%', height: 140, backgroundColor: '#cbd5e1' },
  outfitPieceInfo: { padding: 10 },
  outfitPieceCategory: { color: '#f59e0b', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 2 },
  outfitPieceName: { color: '#f8fafc', fontSize: 13, fontWeight: 'bold' },
  outfitPieceSub: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalScrollWrapper: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', width: '100%' },
  modalContent: { width: '100%', minWidth: 310, backgroundColor: '#1e293b', borderRadius: 16, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  modalTopActionsRow: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  accountModalHeaderTitle: { color: '#f8fafc', fontSize: 18, fontWeight: 'bold' },
  accountSectionDivider: { width: '100%', height: 1, backgroundColor: '#334155', marginVertical: 14 },
  accountActionRowBtn: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f172a', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#334155' },
  accountActionRowBtnText: { color: '#f59e0b', fontSize: 14, fontWeight: 'bold' },
  accountActionChevron: { color: '#f59e0b', fontSize: 12, fontWeight: 'bold' },
  accountSubCard: { width: '100%', backgroundColor: '#0f172a', borderRadius: 10, padding: 12, marginTop: 10, borderWidth: 1, borderColor: '#334155' },
  accountResetNote: { color: '#cbd5e1', fontSize: 13, lineHeight: 18, marginBottom: 10 },
  deleteAccountTriggerBtn: { width: '100%', backgroundColor: 'rgba(239, 68, 68, 0.12)', paddingVertical: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#ef4444' },
  deleteAccountTriggerText: { color: '#ef4444', fontSize: 14, fontWeight: 'bold' },
  dangerConfirmBox: { width: '100%', backgroundColor: '#0f172a', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#ef4444' },
  dangerConfirmTitle: { color: '#ef4444', fontSize: 15, fontWeight: 'bold', marginBottom: 6 },
  dangerConfirmBody: { color: '#cbd5e1', fontSize: 13, lineHeight: 18, marginBottom: 10 },
  dangerConfirmInput: { backgroundColor: '#1e293b', color: '#f8fafc', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, fontSize: 14, borderWidth: 1, borderColor: '#ef4444', marginBottom: 12 },
  dangerActionsRow: { flexDirection: 'row', gap: 10 },
  dangerCancelBtn: { flex: 1, backgroundColor: '#334155', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  dangerCancelBtnText: { color: '#f8fafc', fontSize: 13, fontWeight: '600' },
  dangerSubmitBtn: { flex: 1.3, backgroundColor: '#ef4444', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  dangerSubmitBtnText: { color: '#ffffff', fontSize: 13, fontWeight: 'bold' },
  modalEditButton: { backgroundColor: '#0f172a', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#f59e0b' },
  modalEditButtonActive: { backgroundColor: '#334155', borderColor: '#64748b' },
  modalEditButtonText: { color: '#f59e0b', fontSize: 12, fontWeight: 'bold' },
  modalEditButtonTextActive: { color: '#f8fafc' },
  disclaimerTitle: { color: '#f8fafc', fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 12 },
  disclaimerBody: { color: '#cbd5e1', fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 12 },
  disclaimerButtonsRow: { flexDirection: 'row', gap: 10, marginTop: 8, width: '100%' },
  disclaimerSecondaryBtn: { flex: 1, backgroundColor: '#0f172a', paddingVertical: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  disclaimerSecondaryText: { color: '#94a3b8', fontSize: 14, fontWeight: '600' },
  disclaimerPrimaryBtn: { flex: 1, backgroundColor: '#f59e0b', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  disclaimerPrimaryText: { color: '#0f172a', fontSize: 14, fontWeight: 'bold' },
  modalCloseButton: { padding: 4 },
  modalCloseText: { color: '#94a3b8', fontSize: 22, fontWeight: 'bold' },
  enlargedImage: { width: '100%', height: 280, backgroundColor: '#cbd5e1', borderRadius: 8, marginBottom: 14 },
  modalTitle: { color: '#f8fafc', fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
  modalDetailsBox: { width: '100%', backgroundColor: '#0f172a', borderRadius: 10, padding: 12, gap: 6 },
  modalDetailRow: { color: '#f8fafc', fontSize: 14 },
  modalDetailLabel: { color: '#f59e0b', fontWeight: 'bold' },
  editFormContainer: { width: '100%', marginTop: 4 },
  editFieldLabel: { color: '#f59e0b', fontSize: 12, fontWeight: 'bold', marginBottom: 6, marginTop: 8 },
  editCategoryScroll: { gap: 6, paddingBottom: 4 },
  editCatChip: { backgroundColor: '#0f172a', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: '#334155' },
  editCatChipActive: { backgroundColor: '#f59e0b', borderColor: '#f59e0b' },
  editCatChipText: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  editCatChipTextActive: { color: '#0f172a', fontWeight: 'bold' },
  footwearOptionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  editInput: { backgroundColor: '#0f172a', color: '#f8fafc', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, fontSize: 14, borderWidth: 1, borderColor: '#334155' },
  saveEditButton: { backgroundColor: '#f59e0b', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 14 },
  saveEditButtonText: { color: '#0f172a', fontSize: 14, fontWeight: 'bold' },
});