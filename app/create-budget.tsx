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
  KeyboardAvoidingView
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { FirebaseService } from '@/app/services/firebase.service';
import { useAuth } from '@clerk/clerk-expo';
import AppStyles from '@/constants/AppStyles';
import { Budget, BudgetCategory, DEFAULT_BUDGET_CATEGORIES, SUPPORTED_CURRENCIES } from '@/app/types/budget';
// Use a simple ID generator instead of uuid which requires crypto.getRandomValues()
import { TravelPlan } from '@/app/types/travel';

// Simple ID generator function
const generateId = () => {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
};

export default function CreateBudgetScreen() {
  const [loading, setLoading] = useState(false);
  const [savingBudget, setSavingBudget] = useState(false);
  const [travelPlan, setTravelPlan] = useState<Partial<TravelPlan> | null>(null);
  const [budgetName, setBudgetName] = useState('');
  const [totalBudget, setTotalBudget] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState('TRY');
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [notes, setNotes] = useState('');

  const router = useRouter();
  const params = useLocalSearchParams();
  const { userId } = useAuth();
  const travelPlanId = params.travelPlanId as string;

  useEffect(() => {
    if (!travelPlanId) {
      Alert.alert('Hata', 'Seyahat planı ID\'si bulunamadı.');
      router.back();
      return;
    }

    loadTravelPlan();
  }, [travelPlanId]);

  const loadTravelPlan = async () => {
    try {
      setLoading(true);
      const plan = await FirebaseService.TravelPlan.getTravelPlanById(travelPlanId);

      if (!plan || !plan.id) {
        Alert.alert('Hata', 'Seyahat planı bulunamadı.');
        router.back();
        return;
      }

      setTravelPlan(plan);

      // Bütçe adını otomatik olarak ayarla
      setBudgetName(`${plan.destination || 'Seyahat'} Bütçesi`);

      // Varsayılan kategorileri oluştur
      const defaultCategories = DEFAULT_BUDGET_CATEGORIES.map(category => ({
        ...category,
        id: generateId()
      }));

      setCategories(defaultCategories);
    } catch (error) {
      console.error('Seyahat planı yükleme hatası:', error);
      Alert.alert('Hata', 'Seyahat planı yüklenirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryAllocationChange = (id: string, value: string) => {
    const numericValue = value.replace(/[^0-9]/g, '');
    const amount = numericValue === '' ? 0 : parseInt(numericValue, 10);

    setCategories(prevCategories =>
      prevCategories.map(category =>
        category.id === id
          ? { ...category, allocatedAmount: amount }
          : category
      )
    );
  };

  const handleSaveBudget = async () => {
    try {
      if (!userId || !travelPlanId) {
        Alert.alert('Hata', 'Kullanıcı veya seyahat planı bilgisi eksik.');
        return;
      }

      if (!budgetName.trim()) {
        Alert.alert('Hata', 'Lütfen bütçe adı girin.');
        return;
      }

      if (!totalBudget.trim() || isNaN(Number(totalBudget))) {
        Alert.alert('Hata', 'Lütfen geçerli bir toplam bütçe miktarı girin.');
        return;
      }

      setSavingBudget(true);

      // Bütçe nesnesini oluştur
      const budget: Partial<Budget> = {
        userId,
        travelPlanId,
        name: budgetName.trim(),
        totalBudget: Number(totalBudget),
        currency: selectedCurrency,
        categories,
        notes: notes.trim(),
      };

      // Firebase'e kaydet
      const budgetId = await FirebaseService.Budget.createBudget(budget);

      if (budgetId) {
        Alert.alert(
          'Başarılı',
          'Bütçe başarıyla oluşturuldu.',
          [
            {
              text: 'Bütçe Detaylarını Görüntüle',
              onPress: () => router.push(`/budget-details?budgetId=${budgetId}`),
            },
          ]
        );
      }
    } catch (error) {
      console.error('Bütçe oluşturma hatası:', error);
      Alert.alert('Hata', 'Bütçe oluşturulurken bir hata oluştu.');
    } finally {
      setSavingBudget(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={AppStyles.colors.primary} />
        <ThemedText style={styles.loadingText}>Seyahat planı yükleniyor...</ThemedText>
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
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <MaterialCommunityIcons name="chevron-left" size={30} color="#fff" />
        </TouchableOpacity>
        <ThemedText style={styles.title}>Bütçe Oluştur</ThemedText>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.formSection}>
          <ThemedText style={styles.sectionTitle}>Seyahat Bilgileri</ThemedText>
          <View style={styles.infoCard}>
            <MaterialCommunityIcons name="map-marker" size={24} color={AppStyles.colors.primary} />
            <View style={styles.infoCardContent}>
              <ThemedText style={styles.infoCardTitle}>{travelPlan?.destination}</ThemedText>
              <ThemedText style={styles.infoCardSubtitle}>
                {travelPlan?.startDate} • {travelPlan?.days || travelPlan?.duration || '?'} gün
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.formSection}>
          <ThemedText style={styles.sectionTitle}>Bütçe Bilgileri</ThemedText>

          <View style={styles.inputContainer}>
            <ThemedText style={styles.inputLabel}>Bütçe Adı</ThemedText>
            <TextInput
              style={styles.input}
              value={budgetName}
              onChangeText={setBudgetName}
              placeholder="Bütçe adı girin"
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.inputRow}>
            <View style={[styles.inputContainer, { flex: 2, marginRight: 8 }]}>
              <ThemedText style={styles.inputLabel}>Toplam Bütçe</ThemedText>
              <TextInput
                style={styles.input}
                value={totalBudget}
                onChangeText={(text) => setTotalBudget(text.replace(/[^0-9]/g, ''))}
                placeholder="Toplam bütçe miktarı"
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
        </View>

        <View style={styles.formSection}>
          <ThemedText style={styles.sectionTitle}>Kategori Dağılımı</ThemedText>
          <ThemedText style={styles.sectionSubtitle}>
            Her kategori için ayırmak istediğiniz bütçe miktarını girin
          </ThemedText>

          {categories.map((category) => (
            <View key={category.id} style={styles.categoryRow}>
              <View style={styles.categoryIconContainer}>
                <MaterialCommunityIcons name={category.icon} size={24} color={category.color} />
              </View>
              <ThemedText style={styles.categoryName}>{category.name}</ThemedText>
              <View style={styles.categoryInputContainer}>
                <TextInput
                  style={styles.categoryInput}
                  value={category.allocatedAmount > 0 ? category.allocatedAmount.toString() : ''}
                  onChangeText={(value) => handleCategoryAllocationChange(category.id, value)}
                  placeholder="0"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                />
                <ThemedText style={styles.currencyText}>{selectedCurrency}</ThemedText>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.formSection}>
          <ThemedText style={styles.sectionTitle}>Notlar</ThemedText>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Bütçe ile ilgili notlar (isteğe bağlı)"
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity
          style={[styles.saveButton, savingBudget && styles.saveButtonDisabled]}
          onPress={handleSaveBudget}
          disabled={savingBudget}
        >
          {savingBudget ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <MaterialCommunityIcons name="content-save" size={20} color="#fff" />
              <ThemedText style={styles.saveButtonText}>Bütçeyi Kaydet</ThemedText>
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
  header: {
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(76, 102, 159, 0.2)',
    paddingBottom: 16,
  },
  backButton: {
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
  sectionSubtitle: {
    fontSize: 14,
    color: '#999',
    marginBottom: 16,
  },
  infoCard: {
    backgroundColor: AppStyles.colors.dark.card,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.2)',
  },
  infoCardContent: {
    marginLeft: 16,
    flex: 1,
  },
  infoCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  infoCardSubtitle: {
    fontSize: 14,
    color: '#999',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 8,
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
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: AppStyles.colors.dark.card,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.2)',
  },
  categoryIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryName: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  categoryInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  categoryInput: {
    width: 80,
    padding: 8,
    color: '#fff',
    textAlign: 'right',
    fontSize: 16,
  },
  currencyText: {
    color: '#999',
    marginLeft: 4,
    fontSize: 14,
  },
  notesInput: {
    backgroundColor: AppStyles.colors.dark.card,
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.2)',
    fontSize: 16,
    minHeight: 100,
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
