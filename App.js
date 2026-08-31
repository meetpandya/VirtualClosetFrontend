import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Sparkles, CloudRain, Plus, Shirt, Trash2, ArrowLeft, ChevronDown, ChevronUp, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { fetchDailyOutfits, uploadGarmentPhoto, fetchWardrobeItems, deleteGarmentItem } from './api';

// Replace PC_IP / local IP with your live Render URL
const SERVER_URL = 'https://virtual-closet-backend.onrender.com'; // Use your actual Render URL

const SUBTYPE_FILTERS = ['All', 'Polo', 'T-Shirt', 'Full Sleeve Tee', 'Jeans', 'Shorts', 'Pants', 'Sneakers', 'Sports Shoes'];

function MannequinView({ outfitPath }) {
  if (!outfitPath) return null;
  return (
    <View style={styles.mannequinDisplayContainer}>
      <Image
        source={{ uri: `${SERVER_URL}${outfitPath}` }}
        style={styles.mannequinImg}
        resizeMode="contain"
      />
    </View>
  );
}

export default function App() {
  const [selectedGender, setSelectedGender] = useState('Male');
  const [wardrobeItems, setWardrobeItems] = useState([]);
  const [outfits, setOutfits] = useState([]);
  const [activeTab, setActiveTab] = useState(0);
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [viewMode, setViewMode] = useState('closet');

  // Accordion state: track minimized categories
  const [collapsedSections, setCollapsedSections] = useState({});
  // Modal state: tracks item selected for full-screen preview
  const [modalItem, setModalItem] = useState(null);

  const toggleSection = (catName) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [catName]: !prev[catName],
    }));
  };

  const loadWardrobe = async () => {
    const data = await fetchWardrobeItems(selectedGender);
    if (data.status === 'success') {
      setWardrobeItems(data.items);
    }
  };

  useEffect(() => {
    loadWardrobe();
  }, [selectedGender]);

  const handleDeleteItem = (item) => {
    Alert.alert(
      'Delete Garment',
      `Are you sure you want to delete "${item.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const res = await deleteGarmentItem(item.id);
            if (res.status === 'success') {
              loadWardrobe();
            } else {
              Alert.alert('Error', 'Failed to delete item.');
            }
          },
        },
      ]
    );
  };

  const handlePickImage = async (useCamera = false) => {
    const permissionResult = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission Denied', 'Camera and gallery permissions required.');
      return;
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.5, allowsEditing: false })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.5, allowsEditing: false });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setIsUploading(true);
      const response = await fetch(`${SERVER_URL}/api/wardrobe/upload`, { 
        method: 'POST',
        body: formData,
      });
      setIsUploading(false);

      if (response.status === 'success') {
        Alert.alert('Success! ✨', `Added item to ${selectedGender} Wardrobe.`);
        loadWardrobe();
      } else {
        Alert.alert('Upload Failed', 'Backend server error.');
      }
    }
  };

  const showUploadOptions = () => {
    Alert.alert(
      `Add to ${selectedGender} Closet`,
      'Choose image source:',
      [
        { text: 'Take Photo', onPress: () => handlePickImage(true) },
        { text: 'Choose from Gallery', onPress: () => handlePickImage(false) },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleGenerateOutfits = async () => {
    setIsGenerating(true);
    const data = await fetchDailyOutfits(16.0, 'Rain', selectedGender);
    if (data.status === 'success' && data.outfits && data.outfits.length > 0) {
      setOutfits(data.outfits);
      setActiveTab(0);
      setViewMode('outfits');
    } else {
      Alert.alert('Need More Clothes', 'Please upload at least 1 Top, 1 Bottom, and 1 Footwear item!');
    }
    setIsGenerating(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={styles.greetingText}>Virtual Closet ✨</Text>
            <Text style={styles.subText}>{selectedGender} Wardrobe Collection</Text>
          </View>
          <View style={styles.weatherBadge}>
            <CloudRain size={14} color="#1E3A8A" />
            <Text style={styles.weatherText}>16°C</Text>
          </View>
        </View>

        <View style={styles.genderSwitchContainer}>
          <TouchableOpacity
            style={[styles.genderBtn, selectedGender === 'Female' && styles.activeGenderBtn]}
            onPress={() => setSelectedGender('Female')}
          >
            <Text style={[styles.genderText, selectedGender === 'Female' && styles.activeGenderText]}>Female</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.genderBtn, selectedGender === 'Male' && styles.activeGenderBtn]}
            onPress={() => setSelectedGender('Male')}
          >
            <Text style={[styles.genderText, selectedGender === 'Male' && styles.activeGenderText]}>Male</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {isUploading && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#111827" />
            <Text style={styles.loadingText}>Auto-Tagging & Processing Image...</Text>
          </View>
        )}

        {/* CLOSET VIEW */}
        {viewMode === 'closet' && !isUploading && (
          <View>
            {wardrobeItems.length === 0 ? (
              <View style={styles.emptyCard}>
                <Shirt size={48} color="#9CA3AF" style={{ marginBottom: 12 }} />
                <Text style={styles.emptyTitle}>Your Closet is Empty</Text>
                <Text style={styles.emptySub}>
                  Upload photos of your clothes to start generating outfit recommendations.
                </Text>
                <TouchableOpacity style={styles.addBtn} onPress={showUploadOptions}>
                  <Plus size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.addBtnText}>Add Garment</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                {/* TOP CONTROL BAR WITH GENERATE BUTTON */}
                <View style={styles.topControlCard}>
                  <TouchableOpacity
                    style={styles.primaryGenerateBtn}
                    onPress={handleGenerateOutfits}
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Sparkles size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                        <Text style={styles.primaryGenerateBtnText}>Generate Daily Outfits</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>Saved Clothes ({wardrobeItems.length})</Text>
                    <TouchableOpacity style={styles.smallAddBtn} onPress={showUploadOptions}>
                      <Plus size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                      <Text style={styles.smallAddBtnText}>Add Item</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* FILTER CHIPS BAR */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar}>
                  {SUBTYPE_FILTERS.map((filter) => (
                    <TouchableOpacity
                      key={filter}
                      style={[styles.filterChip, selectedFilter === filter && styles.activeFilterChip]}
                      onPress={() => setSelectedFilter(filter)}
                    >
                      <Text style={[styles.filterChipText, selectedFilter === filter && styles.activeFilterChipText]}>
                        {filter}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* CATEGORIZED ACCORDION SECTIONS */}
                {['Tops', 'Bottoms', 'Footwear', 'Outerwear'].map((catName) => {
                  const categoryItems = wardrobeItems.filter((item) => {
                    const c = (item.category || '').toLowerCase();
                    const sub = (item.sub_type || '').toLowerCase();
                    const name = (item.name || '').toLowerCase();

                    if (selectedFilter !== 'All') {
                      const f = selectedFilter.toLowerCase();
                      const matchesFilter = sub.includes(f) || name.includes(f) || c.includes(f);
                      if (!matchesFilter) return false;
                    }

                    if (catName === 'Tops') return c.includes('top') || c.includes('shirt');
                    if (catName === 'Bottoms') return c.includes('bottom') || c.includes('pant') || c.includes('jean') || c.includes('short');
                    if (catName === 'Footwear') return c.includes('foot') || c.includes('shoe') || c.includes('sneaker');
                    if (catName === 'Outerwear') return c.includes('outer') || c.includes('jacket') || c.includes('coat');
                    return false;
                  });

                  if (categoryItems.length === 0) return null;
                  const isCollapsed = collapsedSections[catName];

                  return (
                    <View key={catName} style={styles.categorySection}>
                      <TouchableOpacity
                        style={styles.categoryHeaderRow}
                        onPress={() => toggleSection(catName)}
                        activeOpacity={0.7}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={styles.categorySectionTitle}>{catName.toUpperCase()}</Text>
                          <Text style={styles.categoryItemCount}>{categoryItems.length}</Text>
                        </View>
                        {isCollapsed ? <ChevronDown size={18} color="#6B7280" /> : <ChevronUp size={18} color="#6B7280" />}
                      </TouchableOpacity>

                      {!isCollapsed && (
                        <View style={styles.grid}>
                          {categoryItems.map((item) => (
                            <TouchableOpacity
                              key={item.id}
                              style={styles.tile}
                              activeOpacity={0.8}
                              onPress={() => setModalItem(item)}
                            >
                              <Image
                                source={{ uri: `http://${PC_IP}:8000${item.image_path}` }}
                                style={styles.tileImg}
                                resizeMode="contain"
                              />
                              <TouchableOpacity
                                style={styles.deleteBtn}
                                onPress={(e) => {
                                  e.stopPropagation();
                                  handleDeleteItem(item);
                                }}
                              >
                                <Trash2 size={14} color="#EF4444" />
                              </TouchableOpacity>
                              <View style={styles.tileOverlay}>
                                <Text style={styles.tileCategory}>
                                  {item.sub_type ? item.sub_type.toUpperCase() : item.category.toUpperCase()}
                                </Text>
                                <Text style={styles.tileName} numberOfLines={1}>{item.name}</Text>
                              </View>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* OUTFITS VIEW */}
        {viewMode === 'outfits' && (
          <View>
            <TouchableOpacity onPress={() => setViewMode('closet')} style={styles.backLink}>
              <ArrowLeft size={16} color="#4B5563" style={{ marginRight: 6 }} />
              <Text style={styles.backLinkText}>Back to Wardrobe</Text>
            </TouchableOpacity>

            <Text style={styles.pageHeaderTitle}>Daily Recommendations</Text>

            <View style={styles.segmentedControl}>
              {outfits.map((outfit, index) => (
                <TouchableOpacity
                  key={outfit.option_id}
                  style={[styles.segmentBtn, activeTab === index && styles.activeSegmentBtn]}
                  onPress={() => setActiveTab(index)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.segmentText, activeTab === index && styles.activeSegmentText]}>
                    {outfit.styleName}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {outfits.length > 0 && (
              <View style={styles.aestheticCard}>
                <View style={styles.badgeRow}>
                  <Sparkles size={14} color="#6366F1" />
                  <Text style={styles.badgeText}>{outfits[activeTab]?.styleName.toUpperCase()}</Text>
                </View>

                <MannequinView outfitPath={outfits[activeTab]?.mannequin_image} />

                <View style={styles.itemsBreakdownContainer}>
                  <Text style={styles.breakdownLabel}>OUTFIT COMPONENTS</Text>
                  <View style={styles.grid}>
                    <ItemTile item={outfits[activeTab]?.items.top} category="TOP" onSelect={setModalItem} />
                    <ItemTile item={outfits[activeTab]?.items.outerwear} category="OUTERWEAR" onSelect={setModalItem} />
                    <ItemTile item={outfits[activeTab]?.items.bottom} category="BOTTOM" onSelect={setModalItem} />
                    <ItemTile item={outfits[activeTab]?.items.footwear} category="FOOTWEAR" onSelect={setModalItem} />
                  </View>
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* FULL-SCREEN GARMENT PREVIEW MODAL */}
      <Modal
        visible={!!modalItem}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalItem(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalCloseBtn}
            onPress={() => setModalItem(null)}
          >
            <X size={22} color="#FFFFFF" />
          </TouchableOpacity>

          {modalItem && (
            <View style={styles.modalContentCard}>
              <View style={styles.modalImageWrapper}>
                <Image
                  source={{ uri: `http://${PC_IP}:8000${modalItem.image_path}` }}
                  style={styles.modalImg}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.modalDetails}>
                <Text style={styles.modalCategory}>
                  {(modalItem.sub_type || modalItem.category || '').toUpperCase()}
                </Text>
                <Text style={styles.modalTitle}>{modalItem.name}</Text>
                {modalItem.primary_color && (
                  <Text style={styles.modalSubDetail}>Color: {modalItem.primary_color}</Text>
                )}
              </View>
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function ItemTile({ item, category, onSelect }) {
  return (
    <TouchableOpacity
      style={styles.tile}
      activeOpacity={item && item.image_path ? 0.7 : 1}
      onPress={() => item && item.image_path && onSelect && onSelect(item)}
    >
      {item && item.image_path ? (
        <>
          <Image source={{ uri: `http://${PC_IP}:8000${item.image_path}` }} style={styles.tileImg} resizeMode="contain" />
          <View style={styles.tileOverlay}>
            <Text style={styles.tileCategory}>{category}</Text>
            <Text style={styles.tileName} numberOfLines={1}>{item.name}</Text>
          </View>
        </>
      ) : (
        <View style={styles.tileEmpty}>
          <Text style={{ fontSize: 10, color: '#9CA3AF' }}>None</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF9F6' },
  scrollContent: { padding: 20 },
  header: { padding: 20, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  greetingText: { fontSize: 22, fontWeight: '700', color: '#111827' },
  subText: { fontSize: 12, color: '#6B7280', marginBottom: 12 },
  weatherBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EBF5FF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  weatherText: { fontSize: 12, fontWeight: '600', color: '#1E3A8A', marginLeft: 4 },
  genderSwitchContainer: { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 12, padding: 4, marginTop: 10 },
  genderBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  activeGenderBtn: { backgroundColor: '#111827' },
  genderText: { fontSize: 13, fontWeight: '600', color: '#4B5563' },
  activeGenderText: { color: '#FFFFFF' },
  topControlCard: { marginBottom: 16 },
  primaryGenerateBtn: { flexDirection: 'row', backgroundColor: '#111827', paddingVertical: 16, paddingHorizontal: 24, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 16, elevation: 4 },
  primaryGenerateBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  smallAddBtn: { flexDirection: 'row', backgroundColor: '#111827', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center' },
  smallAddBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 12 },
  filterBar: { marginBottom: 16, flexDirection: 'row' },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#E5E7EB', marginRight: 8 },
  activeFilterChip: { backgroundColor: '#111827' },
  filterChipText: { fontSize: 12, fontWeight: '600', color: '#4B5563' },
  activeFilterChipText: { color: '#FFFFFF' },
  categorySection: { marginBottom: 16 },
  categoryHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingBottom: 8, marginBottom: 12 },
  categorySectionTitle: { fontSize: 12, fontWeight: '800', color: '#4B5563', letterSpacing: 1.2 },
  categoryItemCount: { marginLeft: 8, fontSize: 11, fontWeight: '700', color: '#9CA3AF', backgroundColor: '#F3F4F6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  emptyCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, alignItems: 'center', marginTop: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 },
  emptySub: { fontSize: 13, color: '#6B7280', textAlign: 'center', marginBottom: 24 },
  addBtn: { flexDirection: 'row', backgroundColor: '#111827', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, alignItems: 'center' },
  addBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tile: { width: '48%', height: 160, borderRadius: 12, backgroundColor: '#FFFFFF', overflow: 'hidden', marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  tileEmpty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tileImg: { width: '100%', height: '100%' },
  tileOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)', padding: 6 },
  tileCategory: { fontSize: 8, color: '#E5E7EB', fontWeight: '800' },
  tileName: { fontSize: 11, color: '#FFFFFF', fontWeight: '600' },
  loadingBox: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 30, alignItems: 'center', marginTop: 20 },
  loadingText: { marginTop: 12, fontSize: 13, color: '#4B5563', fontWeight: '600' },
  backLink: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  backLinkText: { color: '#4B5563', fontWeight: '600', fontSize: 13 },
  deleteBtn: { position: 'absolute', top: 6, right: 6, backgroundColor: '#FEE2E2', padding: 6, borderRadius: 20, zIndex: 10 },
  pageHeaderTitle: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 16, letterSpacing: -0.5 },
  segmentedControl: { flexDirection: 'row', backgroundColor: '#E5E7EB', borderRadius: 14, padding: 4, marginBottom: 20 },
  segmentBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  activeSegmentBtn: { backgroundColor: '#FFFFFF', elevation: 2 },
  segmentText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  activeSegmentText: { color: '#111827', fontWeight: '700' },
  aestheticCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#F3F4F6' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  badgeText: { fontSize: 11, fontWeight: '800', color: '#6366F1', marginLeft: 6, letterSpacing: 1 },
  mannequinDisplayContainer: { backgroundColor: '#FAFAFA', borderRadius: 18, height: 440, padding: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#F3F4F6' },
  mannequinImg: { width: '100%', height: '100%' },
  itemsBreakdownContainer: { marginTop: 8 },
  breakdownLabel: { fontSize: 10, fontWeight: '800', color: '#9CA3AF', letterSpacing: 1.2, marginBottom: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCloseBtn: { position: 'absolute', top: 50, right: 24, backgroundColor: 'rgba(255, 255, 255, 0.2)', padding: 10, borderRadius: 25, zIndex: 20 },
  modalContentCard: { width: '90%', backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, alignItems: 'center', elevation: 10 },
  modalImageWrapper: { width: '100%', height: 380, backgroundColor: '#FAFAFA', borderRadius: 16, padding: 10 },
  modalImg: { width: '100%', height: '100%' },
  modalDetails: { marginTop: 16, alignItems: 'center' },
  modalCategory: { fontSize: 10, fontWeight: '800', color: '#6366F1', letterSpacing: 1.5, marginBottom: 4 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827', textAlign: 'center' },
  modalSubDetail: { fontSize: 12, fontWeight: '500', color: '#6B7280', marginTop: 4 },
});