export const AI_PROMPT = `Sen bir seyahat asistanısın. Aşağıdaki bilgilere göre detaylı bir seyahat planı oluştur:

Konum: {location}
Toplam Gün: {totalDays}
Seyahat Arkadaşı: {traveller}
Bütçe: {budget}
Yaşadığı Ülke: {residenceCountry}
Vatandaşlık: {citizenship}

Lütfen aşağıdaki başlıklar altında detaylı bir plan oluştur:
1. Günlük Program
2. Önerilen Mekanlar
3. Yemek Önerileri
4. Ulaşım Bilgileri
5. Bütçe Planlaması
6. Önemli İpuçları`;

export const budgetOptions = [
  { value: 'budget', title: 'Ekonomik', description: 'Uygun fiyatlı seçenekler' },
  { value: 'moderate', title: 'Orta', description: 'Dengeli fiyat ve kalite' },
  { value: 'luxury', title: 'Lüks', description: 'En iyi deneyim için' },
];

export const companionOptions = [
  { value: 'solo', title: 'Solo', description: 'Tek başıma', people: 1 },
  { value: 'couple', title: 'Çift', description: 'İki kişilik', people: 2 },
  { value: 'family', title: 'Aile', description: 'Aile ile', people: 4 },
  { value: 'group', title: 'Grup', description: 'Arkadaş grubu', people: 6 },
]; 