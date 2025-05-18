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
import { Budget, Expense, MaterialCommunityIconName } from '@/app/types/budget';
import AppStyles from '@/constants/AppStyles';
import { PieChart, BarChart } from 'react-native-chart-kit';

const screenWidth = Dimensions.get('window').width;

export default function BudgetAnalysisScreen() {
  const [loading, setLoading] = useState(true);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalSpent, setTotalSpent] = useState(0);
  const [remainingBudget, setRemainingBudget] = useState(0);
  const [dailyExpenses, setDailyExpenses] = useState<{ date: string; amount: number }[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'categories' | 'timeline'>('overview');

  const router = useRouter();
  const params = useLocalSearchParams();
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

      // Toplam harcama ve kalan bütçeyi hesapla
      const spent = expensesData.reduce((sum, expense) => sum + expense.amount, 0);
      setTotalSpent(spent);
      setRemainingBudget(budgetData.totalBudget - spent);

      // Günlük harcamaları hesapla
      calculateDailyExpenses(expensesData);
    } catch (error) {
      console.error('Bütçe verisi yükleme hatası:', error);
      Alert.alert('Hata', 'Bütçe bilgileri yüklenirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const calculateDailyExpenses = (expensesData: Expense[]) => {
    const dailyMap = new Map<string, number>();

    expensesData.forEach(expense => {
      const date = new Date(expense.date).toLocaleDateString('tr-TR');
      const currentAmount = dailyMap.get(date) || 0;
      dailyMap.set(date, currentAmount + expense.amount);
    });

    // Son 7 günü al ve sırala
    const sortedDailyExpenses = Array.from(dailyMap.entries())
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => {
        const dateA = new Date(a.date.split('.').reverse().join('-'));
        const dateB = new Date(b.date.split('.').reverse().join('-'));
        return dateA.getTime() - dateB.getTime();
      })
      .slice(-7); // Son 7 gün

    setDailyExpenses(sortedDailyExpenses);
  };

  // Grafik verilerini hazırla
  const getPieChartData = () => {
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

  // Zaman çizelgesi grafik verilerini hazırla
  const getBarChartData = () => {
    if (dailyExpenses.length === 0) {
      // Return a valid ChartData object with empty data instead of null
      return {
        labels: [],
        datasets: [{ data: [] }],
      };
    }

    return {
      labels: dailyExpenses.map(item => item.date.substring(0, 5)), // Kısa tarih formatı
      datasets: [
        {
          data: dailyExpenses.map(item => item.amount),
        },
      ],
    };
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
        <ThemedText style={styles.title}>Bütçe Analizi</ThemedText>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'overview' && styles.activeTabButton]}
          onPress={() => setActiveTab('overview')}
        >
          <MaterialCommunityIcons
            name="chart-pie"
            size={20}
            color={activeTab === 'overview' ? '#fff' : '#999'}
          />
          <ThemedText style={[styles.tabButtonText, activeTab === 'overview' && styles.activeTabButtonText]}>
            Genel Bakış
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'categories' && styles.activeTabButton]}
          onPress={() => setActiveTab('categories')}
        >
          <MaterialCommunityIcons
            name="tag-multiple"
            size={20}
            color={activeTab === 'categories' ? '#fff' : '#999'}
          />
          <ThemedText style={[styles.tabButtonText, activeTab === 'categories' && styles.activeTabButtonText]}>
            Kategoriler
          </ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'timeline' && styles.activeTabButton]}
          onPress={() => setActiveTab('timeline')}
        >
          <MaterialCommunityIcons
            name="chart-timeline-variant"
            size={20}
            color={activeTab === 'timeline' ? '#fff' : '#999'}
          />
          <ThemedText style={[styles.tabButtonText, activeTab === 'timeline' && styles.activeTabButtonText]}>
            Zaman Çizelgesi
          </ThemedText>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'overview' && (
          <View>
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
              <ThemedText style={styles.sectionTitle}>Harcama Dağılımı</ThemedText>

              {getPieChartData().length > 0 ? (
                <View style={styles.chartContainer}>
                  <PieChart
                    data={getPieChartData()}
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
          </View>
        )}

        {activeTab === 'categories' && (
          <View style={styles.sectionContainer}>
            <ThemedText style={styles.sectionTitle}>Kategori Detayları</ThemedText>

            {budget.categories.map(category => (
              <View key={category.id} style={styles.categoryCard}>
                <View style={styles.categoryHeader}>
                  <View style={[styles.categoryIconContainer, { backgroundColor: category.color }]}>
                    <MaterialCommunityIcons name={category.icon} size={20} color="#fff" />
                  </View>
                  <ThemedText style={styles.categoryName}>{category.name}</ThemedText>
                  <ThemedText style={styles.categoryPercentage}>
                    {getCategorySpendingPercentage(category.id)}%
                  </ThemedText>
                </View>

                <View style={styles.categoryDetails}>
                  <View style={styles.categoryDetailItem}>
                    <ThemedText style={styles.categoryDetailLabel}>Ayrılan Bütçe</ThemedText>
                    <ThemedText style={styles.categoryDetailValue}>
                      {CurrencyService.formatCurrency(category.allocatedAmount, budget.currency)}
                    </ThemedText>
                  </View>

                  <View style={styles.categoryDetailItem}>
                    <ThemedText style={styles.categoryDetailLabel}>Harcanan</ThemedText>
                    <ThemedText style={[styles.categoryDetailValue, { color: category.spentAmount > category.allocatedAmount ? '#FF6384' : '#fff' }]}>
                      {CurrencyService.formatCurrency(category.spentAmount, budget.currency)}
                    </ThemedText>
                  </View>

                  <View style={styles.categoryDetailItem}>
                    <ThemedText style={styles.categoryDetailLabel}>Kalan</ThemedText>
                    <ThemedText style={[styles.categoryDetailValue, { color: category.allocatedAmount - category.spentAmount < 0 ? '#FF6384' : '#4BC0C0' }]}>
                      {CurrencyService.formatCurrency(category.allocatedAmount - category.spentAmount, budget.currency)}
                    </ThemedText>
                  </View>
                </View>

                {category.allocatedAmount > 0 && (
                  <View style={styles.categoryProgressContainer}>
                    <View style={styles.categoryProgressBar}>
                      <View
                        style={[
                          styles.categoryProgressFill,
                          {
                            width: `${Math.min(100, (category.spentAmount / category.allocatedAmount) * 100)}%`,
                            backgroundColor: category.spentAmount > category.allocatedAmount ? '#FF6384' : category.color
                          }
                        ]}
                      />
                    </View>
                    <ThemedText style={styles.categoryProgressText}>
                      {Math.round((category.spentAmount / category.allocatedAmount) * 100)}% kullanıldı
                    </ThemedText>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {activeTab === 'timeline' && (
          <View style={styles.sectionContainer}>
            <ThemedText style={styles.sectionTitle}>Günlük Harcama Analizi</ThemedText>

            {dailyExpenses.length > 0 ? (
              <View style={styles.chartContainer}>
                <BarChart
                  data={getBarChartData()}
                  width={screenWidth - 32}
                  height={220}
                  yAxisLabel=""
                  yAxisSuffix=""
                  chartConfig={{
                    backgroundColor: 'transparent',
                    backgroundGradientFrom: '#222',
                    backgroundGradientTo: '#222',
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(76, 102, 159, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                    style: {
                      borderRadius: 16,
                    },
                    propsForDots: {
                      r: '6',
                      strokeWidth: '2',
                      stroke: '#ffa726',
                    },
                  }}
                  style={{
                    marginVertical: 8,
                    borderRadius: 16,
                  }}
                />
              </View>
            ) : (
              <View style={styles.noDataContainer}>
                <MaterialCommunityIcons name="chart-timeline-variant" size={50} color="#666" />
                <ThemedText style={styles.noDataText}>Henüz harcama kaydı yok</ThemedText>
              </View>
            )}

            <ThemedText style={styles.sectionSubtitle}>Son Harcamalar</ThemedText>

            {expenses.length > 0 ? (
              expenses.slice(0, 5).map((expense) => {
                const category = budget.categories.find(cat => cat.id === expense.categoryId);
                return (
                  <View key={expense.id} style={styles.expenseItem}>
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
                  </View>
                );
              })
            ) : (
              <View style={styles.noDataContainer}>
                <MaterialCommunityIcons name="cash-remove" size={50} color="#666" />
                <ThemedText style={styles.noDataText}>Henüz harcama kaydı yok</ThemedText>
              </View>
            )}
          </View>
        )}
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
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(76, 102, 159, 0.2)',
    paddingHorizontal: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTabButton: {
    borderBottomWidth: 2,
    borderBottomColor: AppStyles.colors.primary,
  },
  tabButtonText: {
    fontSize: 14,
    color: '#999',
    marginLeft: 8,
  },
  activeTabButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  sectionSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginTop: 24,
    marginBottom: 16,
  },
  chartContainer: {
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: AppStyles.colors.dark.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.2)',
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
  },
  categoryCard: {
    backgroundColor: AppStyles.colors.dark.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(76, 102, 159, 0.2)',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  categoryIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: AppStyles.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
  },
  categoryPercentage: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  categoryDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  categoryDetailItem: {
    flex: 1,
    alignItems: 'center',
  },
  categoryDetailLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  categoryDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  categoryProgressContainer: {
    marginTop: 8,
  },
  categoryProgressBar: {
    height: 6,
    backgroundColor: 'rgba(76, 102, 159, 0.2)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  categoryProgressFill: {
    height: '100%',
    backgroundColor: AppStyles.colors.primary,
    borderRadius: 3,
  },
  categoryProgressText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
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
