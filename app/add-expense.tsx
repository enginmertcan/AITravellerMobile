import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Image
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { FirebaseService } from '@/app/services/firebase.service';
import { CurrencyService } from '@/app/services/currency.service';
import { useAuth, useUser } from '@clerk/clerk-expo';
import AppStyles from '@/constants/AppStyles';
import { Budget, SUPPORTED_CURRENCIES } from '@/app/types/budget';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/app/services/firebaseConfig';

export default function AddExpenseScreen() {
  const [loading, setLoading] = useState(true);
  const [savingExpense, setSavingExpense] = useState(false);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState('');
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [location, setLocation] = useState('');
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const router = useRouter();
  const params = useLocalSearchParams();
  const { userId } = useAuth();
  const { user } = useUser();
  const budgetId = params.budgetId as string;

  // Hata ayıklama için userId'yi kontrol et
  useEffect(() => {
    console.log("Auth userId:", userId);
    console.log("User object:", user?.id);
  }, [userId, user]);

  useEffect(() => {
    if (!budgetId) {
      Alert.alert('Hata', 'Bütçe ID\'si bulunamadı.');
      router.back();
      return;
    }

    loadBudgetData();
  }, [budgetId]);

  const loadBudgetData = async () => {
    try {
      setLoading(true);
      console.log("Bütçe yükleniyor, budgetId:", budgetId);

      // Bütçe bilgilerini getir
      const budgetData = await FirebaseService.Budget.getBudget(budgetId);
      console.log("Bütçe verileri:", budgetData ? "Yüklendi" : "Bulunamadı");

      if (!budgetData) {
        Alert.alert('Hata', 'Bütçe bulunamadı.');
        router.back();
        return;
      }

      // Kategorileri kontrol et
      if (!budgetData.categories || budgetData.categories.length === 0) {
        console.warn("Bütçede kategori bulunamadı!");

        // Kullanıcıya varsayılan kategorileri eklemek isteyip istemediğini sor
        Alert.alert(
          '✨ Kategori Gerekiyor',
          'Harcama ekleyebilmek için kategorilere ihtiyacınız var. Sizin için hazırladığımız kategorileri eklemek ister misiniz?\n\n• Konaklama\n• Yemek\n• Ulaşım\n• Aktiviteler\n• Alışveriş\n• Diğer',
          [
            {
              text: 'Vazgeç',
              style: 'cancel',
              onPress: () => {
                router.back();
              }
            },
            {
              text: '✅ Kategorileri Ekle',
              style: 'default',
              onPress: async () => {
                try {
                  // Varsayılan kategorileri ekle
                  const DEFAULT_BUDGET_CATEGORIES = [
                    { name: 'Konaklama', icon: 'bed', color: '#FF6384' },
                    { name: 'Yemek', icon: 'food', color: '#36A2EB' },
                    { name: 'Ulaşım', icon: 'train-car', color: '#FFCE56' },
                    { name: 'Aktiviteler', icon: 'ticket', color: '#4BC0C0' },
                    { name: 'Alışveriş', icon: 'shopping', color: '#9966FF' },
                    { name: 'Diğer', icon: 'dots-horizontal', color: '#FF9F40' }
                  ];

                  // Benzersiz ID'ler oluştur
                  const categoriesWithIds = DEFAULT_BUDGET_CATEGORIES.map(category => ({
                    ...category,
                    id: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
                    allocatedAmount: 0,
                    spentAmount: 0
                  }));

                  // Bütçeyi güncelle
                  await FirebaseService.Budget.updateBudget(budgetId, {
                    categories: categoriesWithIds
                  });

                  // Bütçe verilerini yeniden yükle
                  loadBudgetData();

                  // Başarılı mesajı göster
                  Alert.alert(
                    '✅ Kategoriler Eklendi',
                    'Harika! Kategoriler başarıyla eklendi. Şimdi harcamalarınızı ekleyebilirsiniz.',
                    [
                      {
                        text: 'Devam Et',
                        style: 'default'
                      }
                    ]
                  );
                } catch (error) {
                  console.error('Kategori ekleme hatası:', error);
                  Alert.alert(
                    '❌ Hata Oluştu',
                    'Kategoriler eklenirken bir sorun oluştu. Lütfen daha sonra tekrar deneyin.',
                    [
                      {
                        text: 'Geri Dön',
                        style: 'default',
                        onPress: () => router.back()
                      }
                    ]
                  );
                }
              }
            }
          ]
        );
        return;
      }

      console.log("Kategoriler:", budgetData.categories.map(c => c.name).join(", "));

      setBudget(budgetData);
      setSelectedCurrency(budgetData.currency);

      // Varsayılan kategori seç
      if (budgetData.categories && budgetData.categories.length > 0) {
        const firstCategoryId = budgetData.categories[0].id;
        console.log("Varsayılan kategori seçildi:", firstCategoryId);
        setSelectedCategoryId(firstCategoryId);
      }
    } catch (error) {
      console.error('Bütçe verisi yükleme hatası:', error);
      Alert.alert('Hata', 'Bütçe bilgileri yüklenirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setUploadingImage(true);
        const imageUri = result.assets[0].uri;
        const imageUrl = await uploadReceiptImage(imageUri);
        setReceiptImage(imageUrl);
        setUploadingImage(false);
      }
    } catch (error) {
      console.error('Resim seçme hatası:', error);
      Alert.alert('Hata', 'Resim seçilirken bir hata oluştu.');
      setUploadingImage(false);
    }
  };

  const uploadReceiptImage = async (uri: string): Promise<string> => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();

      const filename = `receipts/${userId}/${Date.now()}.jpg`;
      const storageRef = ref(storage, filename);

      await uploadBytes(storageRef, blob);
      const downloadUrl = await getDownloadURL(storageRef);

      return downloadUrl;
    } catch (error) {
      console.error('Resim yükleme hatası:', error);
      throw error;
    }
  };

  const handleSaveExpense = async () => {
    try {
      // Hata ayıklama için değerleri kontrol et
      console.log("handleSaveExpense çağrıldı - değerler:", {
        userId,
        budgetId,
        selectedCategoryId,
        description: description.trim(),
        amount
      });

      if (!userId) {
        Alert.alert('Hata', 'Kullanıcı ID bulunamadı. Lütfen tekrar giriş yapın.');
        return;
      }

      if (!budgetId) {
        Alert.alert('Hata', 'Bütçe ID bulunamadı.');
        return;
      }

      if (!selectedCategoryId) {
        console.error("Kategori seçilmedi!");

        // Eğer bütçe varsa ve kategorileri varsa, ilk kategoriyi otomatik seç
        if (budget && budget.categories && budget.categories.length > 0) {
          const firstCategoryId = budget.categories[0].id;
          console.log("Otomatik kategori seçiliyor:", firstCategoryId);
          setSelectedCategoryId(firstCategoryId);

          // Kullanıcıya bilgi ver
          Alert.alert(
            'Bilgi',
            'Kategori seçilmediği için varsayılan kategori seçildi. Devam etmek istiyor musunuz?',
            [
              {
                text: 'İptal',
                style: 'cancel'
              },
              {
                text: 'Devam Et',
                onPress: () => handleSaveExpense() // Fonksiyonu tekrar çağır
              }
            ]
          );
        } else {
          Alert.alert('Hata', 'Lütfen bir kategori seçin.');
        }
        return;
      }

      if (!description.trim()) {
        Alert.alert('Hata', 'Lütfen harcama açıklaması girin.');
        return;
      }

      if (!amount.trim() || isNaN(Number(amount))) {
        Alert.alert('Hata', 'Lütfen geçerli bir harcama miktarı girin.');
        return;
      }

      setSavingExpense(true);

      let finalAmount = Number(amount);
      let originalAmount = undefined;
      let originalCurrency = undefined;

      // Para birimi dönüştürme
      if (selectedCurrency !== budget?.currency) {
        originalAmount = finalAmount;
        originalCurrency = selectedCurrency;

        // Dönüştürme yap
        finalAmount = await CurrencyService.convertCurrency(
          finalAmount,
          selectedCurrency,
          budget?.currency || 'TRY'
        );
      }

      // Clerk'ten userId'yi al
      const actualUserId = user?.id || userId;
      if (!actualUserId) {
        Alert.alert('Hata', 'Kullanıcı ID bulunamadı. Lütfen tekrar giriş yapın.');
        return;
      }

      // Harcama nesnesini oluştur - receiptImage isteğe bağlı olmalı, undefined olarak gönderme
      const expense = {
        userId: actualUserId,
        budgetId,
        categoryId: selectedCategoryId,
        amount: finalAmount,
        description: description.trim(),
        date,
      };

      // İsteğe bağlı alanları sadece değer varsa ekle
      if (originalAmount !== undefined) {
        expense.originalAmount = originalAmount;
      }

      if (originalCurrency) {
        expense.originalCurrency = originalCurrency;
      }

      if (location.trim()) {
        expense.location = location.trim();
      }

      // Eğer receiptImage varsa ekle, yoksa hiç ekleme
      if (receiptImage) {
        expense.receiptImage = receiptImage;
      }

      // Hata ayıklama için expense nesnesini konsola yazdır
      console.log('Kaydedilecek harcama:', JSON.stringify(expense, null, 2));

      try {
        // Firebase'e kaydet
        const expenseId = await FirebaseService.Expense.addExpense(expense);

        if (expenseId) {
          // Başarılı mesajı göster
          Alert.alert(
            '✅ Harcama Kaydedildi',
            'Harcamanız başarıyla kaydedildi.',
            [
              {
                text: 'Tamam',
                style: 'default',
                onPress: () => {
                  // Doğrudan bütçe detayları sayfasına yönlendir
                  router.push(`/budget-details?budgetId=${budgetId}`);
                },
              }
            ]
          );
        }
      } catch (error) {
        console.error('Expense kaydetme hatası detayı:', error);
        // Hata mesajını göster
        Alert.alert('Hata', `Harcama kaydedilirken bir hata oluştu: ${error.message || 'Bilinmeyen hata'}`);
      }
    } catch (error) {
      console.error('Genel harcama kaydetme hatası:', error);
      Alert.alert('Hata', `İşlem sırasında bir hata oluştu: ${error.message || 'Bilinmeyen hata'}`);
    } finally {
      setSavingExpense(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={AppStyles.colors.primary} />
        <ThemedText style={styles.loadingText}>Bütçe bilgileri yükleniyor...</ThemedText>
      </View>
    );
  }

  if (!budget) {
    return (
      <View style={styles.errorContainer}>
        <MaterialCommunityIcons name="alert-circle-outline" size={50} color="#ff6b6b" />
        <ThemedText style={styles.errorText}>Bütçe bilgisi bulunamadı.</ThemedText>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ThemedText style={styles.backButtonText}>Geri Dön</ThemedText>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButtonIcon}
          onPress={() => router.back()}
        >
          <MaterialCommunityIcons name="chevron-left" size={30} color="#fff" />
        </TouchableOpacity>
        <ThemedText style={styles.title}>Harcama Ekle</ThemedText>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        <View style={styles.formSection}>
          <ThemedText style={styles.sectionTitle}>Harcama Bilgileri</ThemedText>

          <View style={styles.inputContainer}>
            <ThemedText style={styles.inputLabel}>Açıklama</ThemedText>
            <TextInput
              style={styles.input}
              value={description}
              onChangeText={setDescription}
              placeholder="Harcama açıklaması girin"
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.inputRow}>
            <View style={[styles.inputContainer, { flex: 2, marginRight: 8 }]}>
              <ThemedText style={styles.inputLabel}>Miktar</ThemedText>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={(text) => setAmount(text.replace(/[^0-9.]/g, ''))}
                placeholder="Harcama miktarı"
                placeholderTextColor="#999"
                keyboardType="numeric"
              />
            </View>

            <View style={[styles.inputContainer, { flex: 1 }]}>
              <ThemedText style={styles.inputLabel}>Para Birimi</ThemedText>
              <TouchableOpacity
                style={styles.currencySelector}
                onPress={() => setShowCurrencyPicker(!showCurrencyPicker)}
              >
                <ThemedText style={styles.currencySelectorText}>{selectedCurrency}</ThemedText>
                <MaterialCommunityIcons name="chevron-down" size={20} color="#fff" />
              </TouchableOpacity>

              {showCurrencyPicker && (
                <View style={styles.currencyDropdown}>
                  <ScrollView style={{ maxHeight: 200 }}>
                    {SUPPORTED_CURRENCIES.map((currency) => (
                      <TouchableOpacity
                        key={currency.code}
                        style={[
                          styles.currencyOption,
                          selectedCurrency === currency.code && styles.selectedCurrencyOption
                        ]}
                        onPress={() => {
                          setSelectedCurrency(currency.code);
                          setShowCurrencyPicker(false);
                        }}
                      >
                        <ThemedText style={styles.currencyOptionText}>
                          {currency.code} - {currency.name} ({currency.symbol})
                        </ThemedText>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          </View>

          <View style={styles.inputContainer}>
            <View style={styles.labelContainer}>
              <ThemedText style={styles.inputLabel}>Kategori</ThemedText>
              <ThemedText style={styles.requiredLabel}>(Zorunlu)</ThemedText>
            </View>

            {budget.categories && budget.categories.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoryScrollView}
                nestedScrollEnabled={true}
              >
                {budget.categories.map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.categoryButton,
                      selectedCategoryId === category.id && { backgroundColor: category.color },
                      // Seçili değilse border ekle
                      selectedCategoryId !== category.id && { borderWidth: 2, borderColor: category.color }
                    ]}
                    onPress={() => {
                      setSelectedCategoryId(category.id);
                      // Haptic feedback ekle
                      if (Platform.OS === 'ios') {
                        try {
                          const Haptics = require('expo-haptics');
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        } catch (error) {
                          console.log('Haptic feedback not available');
                        }
                      }
                    }}
                  >
                    <MaterialCommunityIcons
                      name={category.icon}
                      size={24}
                      color={selectedCategoryId === category.id ? '#fff' : category.color}
                    />
                    <ThemedText
                      style={[
                        styles.categoryButtonText,
                        selectedCategoryId === category.id && { color: '#fff' }
                      ]}
                    >
                      {category.name}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.noCategoriesContainer}>
                <MaterialCommunityIcons name="alert-circle-outline" size={24} color="#ff6b6b" />
                <ThemedText style={styles.noCategoriesText}>
                  Bu bütçede kategori bulunamadı. Lütfen önce bütçe kategorileri ekleyin.
                </ThemedText>
              </View>
            )}
          </View>

          <View style={styles.inputContainer}>
            <ThemedText style={styles.inputLabel}>Tarih</ThemedText>
            <TouchableOpacity
              style={styles.dateSelector}
              onPress={() => setShowDatePicker(true)}
            >
              <MaterialCommunityIcons name="calendar" size={20} color="#999" />
              <ThemedText style={styles.dateSelectorText}>
                {date.toLocaleDateString('tr-TR')}
              </ThemedText>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={date}
                mode="date"
                display="default"
                onChange={handleDateChange}
                maximumDate={new Date()}
              />
            )}
          </View>

          <View style={styles.inputContainer}>
            <ThemedText style={styles.inputLabel}>Konum (İsteğe Bağlı)</ThemedText>
            <TextInput
              style={styles.input}
              value={location}
              onChangeText={setLocation}
              placeholder="Harcama yeri"
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.inputContainer}>
            <View style={styles.labelContainer}>
              <ThemedText style={styles.inputLabel}>Fiş/Makbuz</ThemedText>
              <ThemedText style={styles.optionalLabel}>(İsteğe Bağlı - Zorunlu Değil)</ThemedText>
            </View>

            {receiptImage ? (
              <View style={styles.receiptImageContainer}>
                <Image source={{ uri: receiptImage }} style={styles.receiptImage} />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => setReceiptImage(null)}
                >
                  <MaterialCommunityIcons name="close-circle" size={24} color="#ff6b6b" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={pickImage}
                disabled={uploadingImage}
              >
                {uploadingImage ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="camera" size={24} color="#fff" />
                    <ThemedText style={styles.uploadButtonText}>Fiş/Makbuz Ekle (İsteğe Bağlı)</ThemedText>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, savingExpense && styles.saveButtonDisabled]}
          onPress={handleSaveExpense}
          disabled={savingExpense}
        >
          {savingExpense ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <MaterialCommunityIcons name="content-save" size={20} color="#fff" />
              <ThemedText style={styles.saveButtonText}>Harcamayı Kaydet</ThemedText>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppStyles.colors.dark.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AppStyles.colors.dark.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: AppStyles.colors.dark.text,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AppStyles.colors.dark.background,
    padding: 24,
  },
  errorText: {
    fontSize: 18,
    color: '#ff6b6b',
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: AppStyles.colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(76, 102, 159, 0.2)',
    paddingBottom: 16,
  },
  backButtonIcon: {
    marginRight: 16,
    backgroundColor: 'rgba(76, 102, 159, 0.1)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.2)',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  formSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 14,
    color: '#ccc',
  },
  optionalLabel: {
    fontSize: 12,
    color: '#999',
    marginLeft: 8,
    fontStyle: 'italic',
  },
  requiredLabel: {
    fontSize: 12,
    color: '#ff6b6b',
    marginLeft: 8,
    fontWeight: 'bold',
  },
  noCategoriesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
    marginTop: 8,
  },
  noCategoriesText: {
    color: '#ff6b6b',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  input: {
    backgroundColor: AppStyles.colors.dark.card,
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.2)',
    fontSize: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySelector: {
    backgroundColor: AppStyles.colors.dark.card,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.2)',
  },
  currencySelectorText: {
    color: '#fff',
    fontSize: 16,
  },
  currencyDropdown: {
    position: 'absolute',
    top: 80,
    left: 0,
    right: 0,
    backgroundColor: '#222',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.2)',
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  currencyOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(76, 102, 159, 0.1)',
  },
  selectedCurrencyOption: {
    backgroundColor: 'rgba(76, 102, 159, 0.2)',
  },
  currencyOptionText: {
    color: '#fff',
    fontSize: 14,
  },
  categoryScrollView: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  categoryButton: {
    backgroundColor: 'rgba(76, 102, 159, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.2)',
    minWidth: 100,
  },
  categoryButtonText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 8,
  },
  dateSelector: {
    backgroundColor: AppStyles.colors.dark.card,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.2)',
  },
  dateSelectorText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 8,
  },
  uploadButton: {
    backgroundColor: AppStyles.colors.primary,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 8,
  },
  receiptImageContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  receiptImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 16,
    padding: 4,
  },
  saveButton: {
    backgroundColor: AppStyles.colors.primary,
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
