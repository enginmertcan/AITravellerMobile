import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  Dimensions
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { FirebaseService } from '@/app/services/firebase.service';
import { CurrencyService } from '@/app/services/currency.service';
import { Budget, Expense } from '@/app/types/budget';
import AppStyles from '@/constants/AppStyles';
import { PieChart } from 'react-native-chart-kit';
import { useAuth } from '@clerk/clerk-expo';

const screenWidth = Dimensions.get('window').width;

export default function BudgetDetailsScreen() {
  const [loading, setLoading] = useState(true);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalSpent, setTotalSpent] = useState(0);
  const [remainingBudget, setRemainingBudget] = useState(0);
  const [travelPlan, setTravelPlan] = useState<any>(null);

  const router = useRouter();
  const params = useLocalSearchParams();
  const { userId } = useAuth();
  const budgetId = params.budgetId as string;

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

      // Bütçe bilgilerini getir
      const budgetData = await FirebaseService.Budget.getBudget(budgetId, userId);

      if (!budgetData) {
        Alert.alert('Hata', 'Bütçe bulunamadı.');
        router.back();
        return;
      }

      setBudget(budgetData);

      // Seyahat planı bilgilerini getir
      if (budgetData.travelPlanId) {
        const planData = await FirebaseService.TravelPlan.getTravelPlanById(budgetData.travelPlanId);
        setTravelPlan(planData);
      }

      // Bütçeye ait harcamaları getir - userId parametresini kaldırdık
      const expensesData = await FirebaseService.Expense.getExpensesByBudgetId(budgetId);
      console.log('Yüklenen harcama sayısı:', expensesData.length);
      setExpenses(expensesData);

      // Toplam harcama ve kalan bütçeyi hesapla
      // Kategori harcama miktarlarını topla (budgetData.categories artık güncel)
      const spent = budgetData.categories.reduce((sum, category) => sum + (category.spentAmount || 0), 0);
      console.log('Hesaplanan toplam harcama:', spent);
      console.log('Kategori harcamaları:', budgetData.categories.map(c => ({ id: c.id, name: c.name, spent: c.spentAmount })));

      setTotalSpent(spent);
      setRemainingBudget(budgetData.totalBudget - spent);
    } catch (error) {
      console.error('Bütçe verisi yükleme hatası:', error);
      Alert.alert('Hata', 'Bütçe bilgileri yüklenirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  // Grafik verilerini hazırla
  const getChartData = () => {
    if (!budget) return [];

    return budget.categories
      .filter(category => category.spentAmount > 0)
      .map(category => ({
        name: category.name,
        spent: category.spentAmount,
        color: category.color,
        legendFontColor: '#7F7F7F',
        legendFontSize: 12,
      }));
  };

  // Kategori bazında harcama yüzdesini hesapla
  const getCategorySpendingPercentage = (categoryId: string) => {
    if (!budget || totalSpent === 0) return 0;

    const category = budget.categories.find(cat => cat.id === categoryId);
    if (!category) return 0;

    return Math.round((category.spentAmount / totalSpent) * 100);
  };

  // Bütçe kullanım yüzdesini hesapla
  const getBudgetUsagePercentage = () => {
    if (!budget || budget.totalBudget === 0) return 0;
    return Math.round((totalSpent / budget.totalBudget) * 100);
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
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButtonIcon}
          onPress={() => router.back()}
        >
          <MaterialCommunityIcons name="chevron-left" size={30} color="#fff" />
        </TouchableOpacity>
        <ThemedText style={styles.title}>Bütçe Detayları</ThemedText>
        {budget.isOwner && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => router.push(`/add-expense?budgetId=${budget.id}`)}
          >
            <MaterialCommunityIcons name="plus" size={24} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {travelPlan && (
          <View style={styles.destinationCard}>
            <MaterialCommunityIcons name="map-marker" size={24} color={AppStyles.colors.primary} />
            <View style={styles.destinationInfo}>
              <ThemedText style={styles.destinationName}>{travelPlan.destination}</ThemedText>
              <ThemedText style={styles.destinationDates}>
                {travelPlan.startDate} • {travelPlan.days || travelPlan.duration || '?'} gün
              </ThemedText>
            </View>
          </View>
        )}

        <View style={styles.budgetSummaryCard}>
          <ThemedText style={styles.budgetName}>{budget.name}</ThemedText>

          <View style={styles.budgetAmountRow}>
            <View style={styles.budgetAmountItem}>
              <ThemedText style={styles.budgetAmountLabel}>Toplam Bütçe</ThemedText>
              <ThemedText style={styles.budgetAmountValue}>
                {CurrencyService.formatCurrency(budget.totalBudget, budget.currency)}
              </ThemedText>
            </View>

            <View style={styles.budgetAmountItem}>
              <ThemedText style={styles.budgetAmountLabel}>Harcanan</ThemedText>
              <ThemedText style={[styles.budgetAmountValue, { color: '#FF6384' }]}>
                {CurrencyService.formatCurrency(totalSpent, budget.currency)}
              </ThemedText>
            </View>

            <View style={styles.budgetAmountItem}>
              <ThemedText style={styles.budgetAmountLabel}>Kalan</ThemedText>
              <ThemedText style={[styles.budgetAmountValue, { color: '#4BC0C0' }]}>
                {CurrencyService.formatCurrency(remainingBudget, budget.currency)}
              </ThemedText>
            </View>
          </View>

          <View style={styles.budgetProgressContainer}>
            <View style={styles.budgetProgressBar}>
              <View
                style={[
                  styles.budgetProgressFill,
                  {
                    width: `${getBudgetUsagePercentage()}%`,
                    backgroundColor: getBudgetUsagePercentage() > 90 ? '#FF6384' : AppStyles.colors.primary
                  }
                ]}
              />
            </View>
            <ThemedText style={styles.budgetProgressText}>
              {getBudgetUsagePercentage()}% kullanıldı
            </ThemedText>
          </View>
        </View>

        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Harcama Dağılımı</ThemedText>
            <TouchableOpacity
              onPress={() => router.push(`/budget-analysis?budgetId=${budget.id}`)}
            >
              <ThemedText style={styles.sectionAction}>Detaylı Analiz</ThemedText>
            </TouchableOpacity>
          </View>

          {getChartData().length > 0 ? (
            <View style={styles.chartContainer}>
              <PieChart
                data={getChartData()}
                width={screenWidth - 32}
                height={220}
                chartConfig={{
                  backgroundColor: '#1e2923',
                  backgroundGradientFrom: '#1e2923',
                  backgroundGradientTo: '#08130D',
                  color: (opacity = 1) => `rgba(26, 255, 146, ${opacity})`,
                }}
                accessor="spent"
                backgroundColor="transparent"
                paddingLeft="0"
                absolute
              />
            </View>
          ) : (
            <View style={styles.noDataContainer}>
              <MaterialCommunityIcons name="chart-pie" size={50} color="#666" />
              <ThemedText style={styles.noDataText}>Henüz harcama kaydı yok</ThemedText>
            </View>
          )}
        </View>

        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Son Harcamalar</ThemedText>
            <TouchableOpacity
              onPress={() => router.push(`/expense-list?budgetId=${budget.id}`)}
            >
              <ThemedText style={styles.sectionAction}>Tümünü Gör</ThemedText>
            </TouchableOpacity>
          </View>

          {expenses.length > 0 ? (
            expenses.slice(0, 5).map((expense) => {
              const category = budget.categories.find(cat => cat.id === expense.categoryId);
              return (
                <TouchableOpacity
                  key={expense.id}
                  style={styles.expenseItem}
                  onPress={() => router.push(`/expense-details?expenseId=${expense.id}`)}
                >
                  <View style={[styles.expenseIconContainer, { backgroundColor: category?.color || '#999' }]}>
                    <MaterialCommunityIcons name={category?.icon || 'cash'} size={20} color="#fff" />
                  </View>
                  <View style={styles.expenseInfo}>
                    <ThemedText style={styles.expenseDescription}>{expense.description}</ThemedText>
                    <ThemedText style={styles.expenseCategory}>{category?.name || 'Diğer'}</ThemedText>
                  </View>
                  <View style={styles.expenseAmount}>
                    <ThemedText style={styles.expenseAmountText}>
                      {CurrencyService.formatCurrency(expense.amount, budget.currency)}
                    </ThemedText>
                    <ThemedText style={styles.expenseDate}>
                      {new Date(expense.date).toLocaleDateString('tr-TR')}
                    </ThemedText>
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={styles.noDataContainer}>
              <MaterialCommunityIcons name="cash-remove" size={50} color="#666" />
              <ThemedText style={styles.noDataText}>Henüz harcama kaydı yok</ThemedText>
              {budget.isOwner ? (
                <TouchableOpacity
                  style={styles.addExpenseButton}
                  onPress={() => router.push(`/add-expense?budgetId=${budget.id}`)}
                >
                  <ThemedText style={styles.addExpenseButtonText}>Harcama Ekle</ThemedText>
                </TouchableOpacity>
              ) : (
                <ThemedText style={styles.noPermissionText}>Sadece bütçe sahibi harcama ekleyebilir</ThemedText>
              )}
            </View>
          )}
        </View>
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
  addButton: {
    backgroundColor: AppStyles.colors.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  destinationCard: {
    backgroundColor: AppStyles.colors.dark.card,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.2)',
  },
  destinationInfo: {
    marginLeft: 16,
    flex: 1,
  },
  destinationName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  destinationDates: {
    fontSize: 14,
    color: '#999',
  },
  budgetSummaryCard: {
    backgroundColor: AppStyles.colors.dark.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.2)',
  },
  budgetName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
  },
  budgetAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  budgetAmountItem: {
    flex: 1,
    alignItems: 'center',
  },
  budgetAmountLabel: {
    fontSize: 14,
    color: '#999',
    marginBottom: 4,
  },
  budgetAmountValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  budgetProgressContainer: {
    marginTop: 8,
  },
  budgetProgressBar: {
    height: 8,
    backgroundColor: 'rgba(76, 102, 159, 0.2)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  budgetProgressFill: {
    height: '100%',
    backgroundColor: AppStyles.colors.primary,
    borderRadius: 4,
  },
  budgetProgressText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'right',
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  sectionAction: {
    fontSize: 14,
    color: AppStyles.colors.primary,
  },
  chartContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  noDataContainer: {
    backgroundColor: AppStyles.colors.dark.card,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.2)',
  },
  noDataText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
    marginBottom: 16,
  },
  noPermissionText: {
    fontSize: 14,
    color: '#ff6b6b',
    marginTop: 16,
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
  expenseCategory: {
    fontSize: 14,
    color: '#999',
  },
  expenseAmount: {
    alignItems: 'flex-end',
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
});
