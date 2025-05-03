import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import TripPhotoGallery from './TripPhotoGallery';

interface TripDetailsPageProps {
  travelPlanId: string;
}

const TripDetailsPage: React.FC<TripDetailsPageProps> = ({ travelPlanId }) => {
  const [travelPlan, setTravelPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchTravelPlan = async () => {
      try {
        setLoading(true);
        const db = getFirestore();
        const travelPlanRef = doc(db, 'travelPlans', travelPlanId);
        const travelPlanDoc = await getDoc(travelPlanRef);
        
        if (!travelPlanDoc.exists()) {
          setError('Seyahat planı bulunamadı');
          setLoading(false);
          return;
        }
        
        setTravelPlan(travelPlanDoc.data());
        setLoading(false);
      } catch (error) {
        console.error('Seyahat planı getirme hatası:', error);
        setError('Seyahat planı yüklenirken bir hata oluştu');
        setLoading(false);
      }
    };
    
    if (travelPlanId) {
      fetchTravelPlan();
    }
  }, [travelPlanId]);

  if (loading) {
    return <div className="flex justify-center items-center p-8">Yükleniyor...</div>;
  }

  if (error) {
    return <div className="text-red-500 p-4">{error}</div>;
  }

  if (!travelPlan) {
    return <div className="text-gray-500 p-4">Seyahat planı bulunamadı.</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">{travelPlan.destination}</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          {/* Seyahat Detayları */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-2xl font-semibold mb-4">Seyahat Bilgileri</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-600">Başlangıç Tarihi</p>
                <p className="font-medium">{travelPlan.startDate}</p>
              </div>
              <div>
                <p className="text-gray-600">Süre</p>
                <p className="font-medium">{travelPlan.duration}</p>
              </div>
              <div>
                <p className="text-gray-600">Bütçe</p>
                <p className="font-medium">{travelPlan.budget}</p>
              </div>
              <div>
                <p className="text-gray-600">Kişi Sayısı</p>
                <p className="font-medium">{travelPlan.numberOfPeople || '-'}</p>
              </div>
            </div>
          </div>
          
          {/* Seyahat Fotoğrafları */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <TripPhotoGallery travelPlanId={travelPlanId} />
          </div>
        </div>
        
        <div className="lg:col-span-1">
          {/* Yan Panel */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-2xl font-semibold mb-4">Hızlı Bilgiler</h2>
            <div className="space-y-4">
              <div>
                <p className="text-gray-600">Ülke</p>
                <p className="font-medium">{travelPlan.country || '-'}</p>
              </div>
              <div>
                <p className="text-gray-600">En İyi Ziyaret Zamanı</p>
                <p className="font-medium">{travelPlan.bestTimeToVisit || '-'}</p>
              </div>
              <div>
                <p className="text-gray-600">Grup Tipi</p>
                <p className="font-medium">{travelPlan.groupType || '-'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TripDetailsPage;
