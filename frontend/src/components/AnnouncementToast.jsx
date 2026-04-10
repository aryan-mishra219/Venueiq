import { useEffect, useState, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { Megaphone, X } from 'lucide-react';

export default function AnnouncementToast() {
  const [announcement, setAnnouncement] = useState(null);
  const [visible, setVisible] = useState(false);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    let unsubscribe = null;

    try {
      const q = query(
        collection(db, 'announcements'),
        orderBy('created_at', 'desc'),
        limit(1)
      );

      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          // Skip the initial load
          if (isFirstLoad.current) {
            isFirstLoad.current = false;
            return;
          }

          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const data = change.doc.data();
              setAnnouncement({
                id: change.doc.id,
                message: data.message,
                target_zone: data.target_zone,
                created_at: data.created_at,
              });
              setVisible(true);

              // Auto-hide after 8 seconds
              setTimeout(() => {
                setVisible(false);
              }, 8000);
            }
          });
        },
        (error) => {
          // Silently handle Firestore errors — don't crash the app
          console.warn('AnnouncementToast listener error (non-fatal):', error.message);
        }
      );
    } catch (err) {
      console.warn('AnnouncementToast setup error (non-fatal):', err.message);
    }

    return () => {
      if (unsubscribe) {
        try {
          unsubscribe();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    };
  }, []);

  if (!visible || !announcement) return null;

  return (
    <div className="announcement-toast">
      <div className="announcement-toast-inner">
        <div className="announcement-toast-header">
          <span className="announcement-toast-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Megaphone size={14} /> Announcement
          </span>
          <button
            className="announcement-toast-close"
            onClick={() => setVisible(false)}
          >
            <X size={16} />
          </button>
        </div>
        <div className="announcement-toast-message">
          {announcement.message}
        </div>
        <div className="announcement-toast-zone">
          Target: {announcement.target_zone === 'all' ? 'All Zones' : announcement.target_zone}
        </div>
      </div>
    </div>
  );
}
