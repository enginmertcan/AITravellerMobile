import React, { useState, useEffect } from 'react';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';
import Image from 'next/image';
import { FiMapPin, FiCalendar, FiX } from 'react-icons/fi';

interface TripPhoto {
  id: string;
  imageUrl?: string;
  location?: string;
  dayNumber?: number;
  uploadedAt: string;
}

interface TripPhotoGalleryProps {
  travelPlanId: string;
}

const TripPhotoGallery: React.FC<TripPhotoGalleryProps> = ({ travelPlanId }) => {
  const [photos, setPhotos] = useState<TripPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<TripPhoto | null>(null);

  useEffect(() => {
    const fetchPhotos = async () => {
      try {
        setLoading(true);
        const db = getFirestore();
        
        // Seyahat planını getir
        const travelPlanRef = collection(db, 'travelPlans');
        const q = query(travelPlanRef, where('id', '==', travelPlanId));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
          setError('Seyahat planı bulunamadı');
          setLoading(false);
          return;
        }
        
        const travelPlanDoc = querySnapshot.docs[0].data();
        
        // Fotoğrafları parse et
        if (travelPlanDoc.tripPhotos) {
          let tripPhotos: TripPhoto[] = [];
          
          if (typeof travelPlanDoc.tripPhotos === 'string') {
            try {
              tripPhotos = JSON.parse(travelPlanDoc.tripPhotos);
            } catch (error) {
              console.error('Fotoğraf verisi parse hatası:', error);
            }
          } else if (Array.isArray(travelPlanDoc.tripPhotos)) {
            tripPhotos = travelPlanDoc.tripPhotos;
          }
          
          setPhotos(tripPhotos);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Fotoğrafları getirme hatası:', error);
        setError('Fotoğraflar yüklenirken bir hata oluştu');
        setLoading(false);
      }
    };
    
    if (travelPlanId) {
      fetchPhotos();
    }
  }, [travelPlanId]);

  const openPhotoModal = (photo: TripPhoto) => {
    setSelectedPhoto(photo);
  };

  const closePhotoModal = () => {
    setSelectedPhoto(null);
  };

  if (loading) {
    return <div className="flex justify-center items-center p-8">Fotoğraflar yükleniyor...</div>;
  }

  if (error) {
    return <div className="text-red-500 p-4">{error}</div>;
  }

  if (photos.length === 0) {
    return <div className="text-gray-500 p-4">Bu seyahat planı için henüz fotoğraf eklenmemiş.</div>;
  }

  return (
    <div className="my-6">
      <h3 className="text-xl font-semibold mb-4">Seyahat Fotoğrafları</h3>
      
      {/* Fotoğraf Galerisi */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {photos.map((photo) => (
          <div 
            key={photo.id} 
            className="relative rounded-lg overflow-hidden cursor-pointer shadow-md hover:shadow-lg transition-shadow"
            onClick={() => openPhotoModal(photo)}
          >
            <div className="aspect-square relative">
              <Image 
                src={photo.imageUrl || '/placeholder-image.jpg'} 
                alt={photo.location || 'Seyahat fotoğrafı'} 
                layout="fill"
                objectFit="cover"
              />
            </div>
            
            {photo.location && (
              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-2">
                <div className="flex items-center text-sm">
                  <FiMapPin className="mr-1" />
                  <span>{photo.location}</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* Fotoğraf Detay Modalı */}
      {selectedPhoto && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
          <div className="relative bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <button 
              className="absolute top-2 right-2 bg-black bg-opacity-50 text-white rounded-full p-2 z-10"
              onClick={closePhotoModal}
            >
              <FiX size={24} />
            </button>
            
            <div className="flex flex-col md:flex-row">
              <div className="md:w-2/3 relative">
                <div className="aspect-square md:aspect-auto md:h-[70vh] relative">
                  <Image 
                    src={selectedPhoto.imageUrl || '/placeholder-image.jpg'} 
                    alt={selectedPhoto.location || 'Seyahat fotoğrafı'} 
                    layout="fill"
                    objectFit="contain"
                  />
                </div>
              </div>
              
              <div className="p-4 md:w-1/3">
                {selectedPhoto.location && (
                  <div className="mb-3">
                    <div className="flex items-center text-gray-800">
                      <FiMapPin className="mr-2" />
                      <span className="font-medium">{selectedPhoto.location}</span>
                    </div>
                  </div>
                )}
                
                {selectedPhoto.dayNumber && (
                  <div className="mb-3">
                    <div className="flex items-center text-gray-800">
                      <FiCalendar className="mr-2" />
                      <span>Gün {selectedPhoto.dayNumber}</span>
                    </div>
                  </div>
                )}
                
                <div className="text-sm text-gray-500 mt-4">
                  {new Date(selectedPhoto.uploadedAt).toLocaleDateString('tr-TR')}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TripPhotoGallery;
