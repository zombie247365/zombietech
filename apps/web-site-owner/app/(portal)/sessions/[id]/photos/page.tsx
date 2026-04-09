import { requireAuth } from '../../../../../lib/auth';
import { api } from '../../../../../lib/api';
import { TopBar } from '../../../../../components/layout/TopBar';
import { Badge } from '../../../../../components/ui/Badge';
import { formatDateTime } from '../../../../../lib/format';
import Link from 'next/link';
import { ChevronLeft, Camera, MapPin, Clock } from 'lucide-react';

interface Props { params: { id: string } }

export default async function SessionPhotosPage({ params }: Props) {
  const token = requireAuth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let photos: any[] = [];
  try {
    const res = await api.sessions.photos(params.id, token);
    photos = res.data as any[];
  } catch { /* show empty */ }

  const byType = {
    before: photos.filter((p) => p.photo_type === 'before'),
    after: photos.filter((p) => p.photo_type === 'after'),
    lockup: photos.filter((p) => p.photo_type === 'lockup'),
  };

  return (
    <>
      <TopBar
        title="Session photos"
        actions={
          <Link href={`/sessions/${params.id}`} className="btn-secondary text-xs px-3 py-1.5">
            <ChevronLeft className="w-3.5 h-3.5" /> Back to session
          </Link>
        }
      />
      <main className="flex-1 p-6 max-w-3xl">
        {photos.length === 0 ? (
          <div className="text-center py-12 text-[#aaa] text-sm">No photos uploaded yet.</div>
        ) : (
          <>
            {(['before', 'after', 'lockup'] as const).map((type) => (
              <div key={type} className="mb-6">
                <div className="section-title capitalize">{type} photos ({byType[type].length})</div>
                <div className="grid grid-cols-2 gap-3">
                  {byType[type].map((photo) => (
                    <div key={photo.id} className="card-white">
                      <div
                        className="rounded-lg h-32 flex items-center justify-center mb-2"
                        style={{ background: type === 'before' ? '#f5f4ef' : type === 'after' ? '#dcfce7' : '#e8f0fc' }}
                      >
                        <Camera className="w-8 h-8 text-[#ccc]" />
                      </div>
                      <p className="text-xs font-medium mb-1">
                        {photo.checklist_item?.area_name ?? '—'}
                      </p>
                      <div className="text-[10px] text-[#aaa] space-y-0.5">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDateTime(photo.device_timestamp)}
                        </div>
                        {photo.latitude && (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {Number(photo.latitude).toFixed(4)}, {Number(photo.longitude).toFixed(4)}
                          </div>
                        )}
                      </div>
                      {photo.download_url && (
                        <a
                          href={photo.download_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-[#1d9e75] mt-1 inline-block"
                        >
                          View full size →
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </main>
    </>
  );
}
