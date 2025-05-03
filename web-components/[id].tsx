import { useRouter } from 'next/router';
import TripDetailsPage from '../components/TripDetailsPage';

export default function TripDetails() {
  const router = useRouter();
  const { id } = router.query;

  if (!id || typeof id !== 'string') {
    return <div className="container mx-auto p-8">Seyahat planı ID'si geçersiz.</div>;
  }

  return <TripDetailsPage travelPlanId={id} />;
}
