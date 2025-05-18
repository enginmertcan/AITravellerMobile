import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  Image
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { FirebaseService } from '@/app/services/firebase.service';
import { CurrencyService } from '@/app/services/currency.service';
import { Budget, Expense } from '@/app/types/budget';
import AppStyles from '@/constants/AppStyles';

export default function ExpenseDetailsScreen() {
  const [loading, setLoading] = useState(true);
  const [expense, setExpense] = useState<Expense | null>(null);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [category, setCategory] = useState<any>(null);

  const router = useRouter();
  const params = useLocalSearchParams();
  const expenseId = params.expenseId as string;

  useEffect(() => {
    if (!expenseId) {
      Alert.alert('Hata', 'Harcama ID\'si bulunamadı.');
      router.back();
      return;
    }

    loadExpenseData();
  }, [expenseId]);

  const loadExpenseData = async () => {
    try {
      setLoading(true);

      // Tüm harcamaları getir ve ID'ye göre filtrele
      // (Firestore'da doğrudan ID ile sorgulama yapmak yerine)
      const allExpenses = await FirebaseService.Expense.getExpensesByBudgetId('all');
      const expenseData = allExpenses.find(e => e.id === expenseId);

      if (!expenseData) {
        Alert.alert('Hata', 'Harcama bulunamadı.');
        router.back();
        return;
      }

      setExpense(expenseData);

      // Bütçe bilgilerini getir
      if (expenseData.budgetId) {
        const budgetData = await FirebaseService.Budget.getBudget(expenseData.budgetId);

        if (budgetData) {
          setBudget(budgetData);

          // Kategori bilgisini bul
          const categoryData = budgetData.categories.find(cat => cat.id === expenseData.categoryId);
          if (categoryData) {
            setCategory(categoryData);
          }
        }
      }
    } catch (error) {
      console.error('Harcama verisi yükleme hatası:', error);
      Alert.alert('Hata', 'Harcama bilgileri yüklenirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteExpense = async () => {
    try {
      Alert.alert(
        'Harcamayı Sil',
        'Bu harcamayı silmek istediğinize emin misiniz?',
        [
          {
            text: 'İptal',
            style: 'cancel',
          },
          {
            text: 'Sil',
            style: 'destructive',
            onPress: async () => {
              setLoading(true);
              const success = await FirebaseService.Expense.deleteExpense(expenseId);

              if (success) {
                Alert.alert('Başarılı', 'Harcama başarıyla silindi.');
                router.back();
              } else {
                Alert.alert('Hata', 'Harcama silinirken bir hata oluştu.');
                setLoading(false);
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Harcama silme hatası:', error);
      Alert.alert('Hata', 'Harcama silinirken bir hata oluştu.');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={AppStyles.colors.primary} />
        <ThemedText style={styles.loadingText}>Harcama bilgileri yükleniyor...</ThemedText>
      </View>
    );
  }

  if (!expense || !budget) {
    return (
      <View style={styles.errorContainer}>
        <MaterialCommunityIcons name="alert-circle-outline" size={50} color="#ff6b6b" />
        <ThemedText style={styles.errorText}>Harcama bilgisi bulunamadı.</ThemedText>
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
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButtonIcon}
          onPress={() => router.back()}
        >
          <MaterialCommunityIcons name="chevron-left" size={30} color="#fff" />
        </TouchableOpacity>
        <ThemedText style={styles.title}>Harcama Detayı</ThemedText>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDeleteExpense}
        >
          <MaterialCommunityIcons name="trash-can-outline" size={24} color="#ff6b6b" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.amountCard}>
          <ThemedText style={styles.amountLabel}>Harcama Tutarı</ThemedText>
          <ThemedText style={styles.amountValue}>
            {CurrencyService.formatCurrency(expense.amount, budget.currency)}
          </ThemedText>

          {expense.originalAmount && expense.originalCurrency && expense.originalCurrency !== budget.currency && (
            <ThemedText style={styles.originalAmount}>
              Orijinal: {CurrencyService.formatCurrency(expense.originalAmount, expense.originalCurrency)}
            </ThemedText>
          )}
        </View>

        <View style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <View style={styles.detailIconContainer}>
              <MaterialCommunityIcons name="text-box-outline" size={20} color="#999" />
            </View>
            <View style={styles.detailContent}>
              <ThemedText style={styles.detailLabel}>Açıklama</ThemedText>
              <ThemedText style={styles.detailValue}>{expense.description}</ThemedText>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <View style={styles.detailIconContainer}>
              <MaterialCommunityIcons name="tag-outline" size={20} color="#999" />
            </View>
            <View style={styles.detailContent}>
              <ThemedText style={styles.detailLabel}>Kategori</ThemedText>
              <View style={styles.categoryContainer}>
                {category && (
                  <View style={[styles.categoryBadge, { backgroundColor: category.color }]}>
                    <MaterialCommunityIcons name={category.icon} size={16} color="#fff" />
                    <ThemedText style={styles.categoryText}>{category.name}</ThemedText>
                  </View>
                )}
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <View style={styles.detailIconContainer}>
              <MaterialCommunityIcons name="calendar" size={20} color="#999" />
            </View>
            <View style={styles.detailContent}>
              <ThemedText style={styles.detailLabel}>Tarih</ThemedText>
              <ThemedText style={styles.detailValue}>
                {new Date(expense.date).toLocaleDateString('tr-TR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </ThemedText>
            </View>
          </View>

          {expense.location && (
            <>
              <View style={styles.divider} />

              <View style={styles.detailRow}>
                <View style={styles.detailIconContainer}>
                  <MaterialCommunityIcons name="map-marker-outline" size={20} color="#999" />
                </View>
                <View style={styles.detailContent}>
                  <ThemedText style={styles.detailLabel}>Konum</ThemedText>
                  <ThemedText style={styles.detailValue}>{expense.location}</ThemedText>
                </View>
              </View>
            </>
          )}

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <View style={styles.detailIconContainer}>
              <MaterialCommunityIcons name="wallet-outline" size={20} color="#999" />
            </View>
            <View style={styles.detailContent}>
              <ThemedText style={styles.detailLabel}>Bütçe</ThemedText>
              <ThemedText style={styles.detailValue}>{budget.name}</ThemedText>
            </View>
          </View>
        </View>

        {expense.receiptImage && (
          <View style={styles.receiptCard}>
            <ThemedText style={styles.receiptTitle}>Fiş/Makbuz</ThemedText>
            <Image
              source={{ uri: expense.receiptImage }}
              style={styles.receiptImage}
              resizeMode="contain"
            />
          </View>
        )}

        <TouchableOpacity
          style={styles.editButton}
          onPress={() => router.push(`/edit-expense?expenseId=${expense.id}`)}
        >
          <MaterialCommunityIcons name="pencil" size={20} color="#fff" />
          <ThemedText style={styles.editButtonText}>Harcamayı Düzenle</ThemedText>
        </TouchableOpacity>
      </ScrollView>
    </View>
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
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.2)',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  amountCard: {
    backgroundColor: AppStyles.colors.dark.card,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.2)',
  },
  amountLabel: {
    fontSize: 16,
    color: '#999',
    marginBottom: 8,
  },
  amountValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
  },
  originalAmount: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  detailsCard: {
    backgroundColor: AppStyles.colors.dark.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.2)',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  detailIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(76, 102, 159, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 14,
    color: '#999',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    color: '#fff',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(76, 102, 159, 0.2)',
    marginVertical: 4,
  },
  categoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppStyles.colors.primary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  categoryText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 4,
  },
  receiptCard: {
    backgroundColor: AppStyles.colors.dark.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.2)',
  },
  receiptTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  receiptImage: {
    width: '100%',
    height: 300,
    borderRadius: 8,
  },
  editButton: {
    backgroundColor: AppStyles.colors.primary,
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
