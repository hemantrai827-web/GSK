
import { Timestamp, DocumentReference, GeoPoint } from 'firebase/firestore';

/**
 * Deeply sanitizes data to ensure it is JSON-serializable.
 * Converts Firestore Timestamps to millis, References to paths, and removes circular deps.
 */
export const formatHourSlot = (hour: number | undefined | null) => {
  if (hour === undefined || hour === null) return '';
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:00 ${ampm}`;
};

export const sanitize = (data: any, visited = new WeakSet<any>()): any => {
  if (data === null || data === undefined) return null;
  
  // Handle primitives
  const type = typeof data;
  if (type !== 'object') return data;

  // Handle Date
  if (data instanceof Date) return data.getTime();

  // Handle Error Objects
  if (data instanceof Error) {
      return { message: data.message, name: data.name };
  }

  // Handle Arrays
  if (Array.isArray(data)) {
    return data.map(item => sanitize(item, visited));
  }

  // Detect Cycle or Complex Objects we shouldn't traverse
  if (visited.has(data)) return null; 
  
  // CRITICAL FIX: Ignore DOM Nodes (Window, Document, Elements)
  if (data.nodeType || (typeof window !== 'undefined' && (data === window || data === document))) return null;
  
  // CRITICAL FIX: Ignore React Synthetic Events
  if (data.nativeEvent || (data._reactName && data.target)) return null;

  visited.add(data);

  // Handle Firestore Timestamp (duck typing)
  if (typeof data.toMillis === 'function') {
      return data.toMillis();
  }
  if (data.seconds !== undefined && data.nanoseconds !== undefined && Object.keys(data).length <= 3) {
      return data.seconds * 1000;
  }

  // Handle Firestore References (duck typing)
  if (data.firestore && data.path && typeof data.id === 'string') {
    return { id: data.id, path: data.path, type: 'ref' };
  }

  // Handle GeoPoints (duck typing)
  if (data.latitude !== undefined && data.longitude !== undefined && Object.keys(data).length <= 3) {
    return { lat: data.latitude, lng: data.longitude };
  }

  // Handle Objects (Recursive Deep Copy)
  const clean: any = {};
  
  try {
      for (const key in data) {
        // Skip private fields, React internals, or known dangerous properties
        if (key.startsWith('_') || key === 'native' || key === 'src' || key === 'target' || key === 'view' || key === 'source' || key === 'firestore' || key === 'app') continue;
        
        // Safety check for own properties
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            const val = data[key];
            // Skip functions
            if (typeof val === 'function') continue;
            
            clean[key] = sanitize(val, visited);
        }
      }
  } catch (e) {
      return null;
  }

  return clean;
};
