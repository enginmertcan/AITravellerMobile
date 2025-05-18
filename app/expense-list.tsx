import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  TextInput,
  ScrollView
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { FirebaseService } from '@/app/services/firebase.service';
import { CurrencyService } from '@/app/services/currency.service';
import { Budget, Expense } from '@/app/types/budget';
import AppStyles from '@/constants/AppStyles';

export default function ExpenseListScreen() {
  const [loading, setLoading] = useState(true);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [filteredExpenses, setFilteredExpenses] = useState<Expense[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'date' | 'amount'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const router = useRouter();
  const params = useLocalSearchParams();
  const budgetId = params.budgetId as string;

  useEffect(() => {
    if (!budgetId) {
      Alert.alert('Hata', 'Bütçe ID\'si bulunamadı.');
      router.back();
      return;
    }

    loadData();
  }, [budgetId]);

  useEffect(() => {
    filterAndSortExpenses();
  }, [expenses, searchText, selectedCategoryId, sortOrder, sortDirection]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Bütçe bilgilerini getir
      const budgetData = await FirebaseService.Budget.getBudget(budgetId);

      if (!budgetData) {
        Alert.alert('Hata', 'Bütçe bulunamadı.');
        router.back();
        return;
      }

      setBudget(budgetData);

      // Bütçeye ait harcamaları getir
      const expensesData = await FirebaseService.Expense.getExpensesByBudgetId(budgetId);
      setExpenses(expensesData);
    } catch (error) {
      console.error('Veri yükleme hatası:', error);
      Alert.alert('Hata', 'Veriler yüklenirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortExpenses = () => {
    if (!expenses.length) {
      setFilteredExpenses([]);
      return;
    }

    let result = [...expenses];

    // Arama filtreleme
    if (searchText) {
      const searchLower = searchText.toLowerCase();
      result = result.filter(expense =>
        expense.description.toLowerCase().includes(searchLower) ||
        (expense.location && expense.location.toLowerCase().includes(searchLower))
      );
    }

    // Kategori filtreleme
    if (selectedCategoryId) {
      result = result.filter(expense => expense.categoryId === selectedCategoryId);
    }

    // Sıralama
    result.sort((a, b) => {
      if (sortOrder === 'date') {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
      } else {
        return sortDirection === 'asc' ? a.amount - b.amount : b.amount - a.amount;
      }
    });

    setFilteredExpenses(result);
  };

  const toggleSortOrder = () => {
    if (sortOrder === 'date') {
      setSortOrder('amount');
    } else {
      setSortOrder('date');
    }
  };

  const toggleSortDirection = () => {
    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
  };

  const handleDeleteExpense = async (expenseId: string, amount: number, categoryId: string) => {
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
                // Harcamayı listeden kaldır
                setExpenses(prevExpenses => prevExpenses.filter(e => e.id !== expenseId));

                // Bütçeyi yeniden yükle (kategori harcama miktarı güncellendi)
                const updatedBudget = await FirebaseService.Budget.getBudget(budgetId);
                if (updatedBudget) {
                  setBudget(updatedBudget);
                }
              }
              setLoading(false);
            },
          },
        ]
      );
    } catch (error) {
      console.error('Harcama silme hatası:', error);
      Alert.alert('Hata', 'Harcama silinirken bir hata oluştu.');
    }
  };

  const renderExpenseItem = ({ item }: { item: Expense }) => {
    if (!budget) return null;

    const category = budget.categories.find(cat => cat.id === item.categoryId);

    return (
      <TouchableOpacity
        style={styles.expenseItem}
        onPress={() => router.push(`/expense-details?expenseId=${item.id}`)}
      >
        <View style={[styles.expenseIconContainer, { backgroundColor: category?.color || '#999' }]}>
          <MaterialCommunityIcons name={category?.icon || 'cash'} size={20} color="#fff" />
        </View>
        <View style={styles.expenseInfo}>
          <ThemedText style={styles.expenseDescription}>{item.description}</ThemedText>
          <View style={styles.expenseDetails}>
            <ThemedText style={styles.expenseCategory}>{category?.name || 'Diğer'}</ThemedText>
            {item.location && (
              <View style={styles.locationContainer}>
                <MaterialCommunityIcons name="map-marker" size={12} color="#999" />
                <ThemedText style={styles.locationText}>{item.location}</ThemedText>
              </View>
            )}
          </View>
        </View>
        <View style={styles.expenseAmount}>
          <ThemedText style={styles.expenseAmountText}>
            {CurrencyService.formatCurrency(item.amount, budget.currency)}
          </ThemedText>
          <ThemedText style={styles.expenseDate}>
            {new Date(item.date).toLocaleDateString('tr-TR')}
          </ThemedText>
        </View>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteExpense(item.id, item.amount, item.categoryId)}
        >
          <MaterialCommunityIcons name="trash-can-outline" size={20} color="#ff6b6b" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={AppStyles.colors.primary} />
        <ThemedText style={styles.loadingText}>Harcamalar yükleniyor...</ThemedText>
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
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButtonIcon}
          onPress={() => router.back()}
        >
          <MaterialCommunityIcons name="chevron-left" size={30} color="#fff" />
        </TouchableOpacity>
        <ThemedText style={styles.title}>Harcama Listesi</ThemedText>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push(`/add-expense?budgetId=${budget.id}`)}
        >
          <MaterialCommunityIcons name="plus" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <MaterialCommunityIcons name="magnify" size={20} color="#999" />
          <TextInput
            style={styles.searchInput}
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Harcama ara..."
            placeholderTextColor="#999"
          />
          {searchText ? (
            <TouchableOpacity onPress={() => setSearchText('')}>
              <MaterialCommunityIcons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={styles.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          nestedScrollEnabled={true}
        >
          <TouchableOpacity
            style={[
              styles.filterButton,
              !selectedCategoryId && styles.activeFilterButton
            ]}
            onPress={() => setSelectedCategoryId(null)}
          >
            <ThemedText style={styles.filterButtonText}>Tümü</ThemedText>
          </TouchableOpacity>

          {budget.categories.map(category => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.filterButton,
                selectedCategoryId === category.id && { backgroundColor: category.color }
              ]}
              onPress={() => setSelectedCategoryId(
                selectedCategoryId === category.id ? null : category.id
              )}
            >
              <MaterialCommunityIcons
                name={category.icon}
                size={16}
                color={selectedCategoryId === category.id ? '#fff' : category.color}
              />
              <ThemedText
                style={[
                  styles.filterButtonText,
                  selectedCategoryId === category.id && { color: '#fff' }
                ]}
              >
                {category.name}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.sortButtons}>
          <TouchableOpacity
            style={styles.sortButton}
            onPress={toggleSortOrder}
          >
            <MaterialCommunityIcons
              name={sortOrder === 'date' ? 'calendar' : 'cash'}
              size={16}
              color="#fff"
            />
            <ThemedText style={styles.sortButtonText}>
              {sortOrder === 'date' ? 'Tarih' : 'Miktar'}
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.sortButton}
            onPress={toggleSortDirection}
          >
            <MaterialCommunityIcons
              name={sortDirection === 'desc' ? 'sort-descending' : 'sort-ascending'}
              size={16}
              color="#fff"
            />
          </TouchableOpacity>
        </View>
      </View>

      {filteredExpenses.length > 0 ? (
        <FlatList
          data={filteredExpenses}
          renderItem={renderExpenseItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          nestedScrollEnabled={true}
          showsVerticalScrollIndicator={false}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
        />
      ) : (
        <View style={styles.noDataContainer}>
          <MaterialCommunityIcons name="cash-remove" size={50} color="#666" />
          <ThemedText style={styles.noDataText}>
            {expenses.length > 0
              ? 'Arama kriterlerine uygun harcama bulunamadı.'
              : 'Henüz harcama kaydı yok'}
          </ThemedText>
          <TouchableOpacity
            style={styles.addExpenseButton}
            onPress={() => router.push(`/add-expense?budgetId=${budget.id}`)}
          >
            <ThemedText style={styles.addExpenseButtonText}>Harcama Ekle</ThemedText>
          </TouchableOpacity>
        </View>
      )}
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
  addButton: {
    backgroundColor: AppStyles.colors.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    padding: 16,
    paddingBottom: 8,
  },
  searchInputContainer: {
    backgroundColor: AppStyles.colors.dark.card,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.2)',
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    marginLeft: 8,
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filterButton: {
    backgroundColor: 'rgba(76, 102, 159, 0.1)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.2)',
  },
  activeFilterButton: {
    backgroundColor: AppStyles.colors.primary,
  },
  filterButtonText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 4,
  },
  sortButtons: {
    flexDirection: 'row',
  },
  sortButton: {
    backgroundColor: 'rgba(76, 102, 159, 0.1)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginLeft: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.2)',
  },
  sortButtonText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 4,
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
  },
  expenseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppStyles.colors.dark.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.2)',
  },
  expenseIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: AppStyles.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  expenseInfo: {
    flex: 1,
  },
  expenseDescription: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 4,
  },
  expenseDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expenseCategory: {
    fontSize: 14,
    color: '#999',
    marginRight: 8,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 12,
    color: '#999',
    marginLeft: 2,
  },
  expenseAmount: {
    alignItems: 'flex-end',
    marginRight: 8,
  },
  expenseAmountText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  expenseDate: {
    fontSize: 12,
    color: '#999',
  },
  deleteButton: {
    padding: 8,
  },
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  noDataText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  addExpenseButton: {
    backgroundColor: AppStyles.colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  addExpenseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
