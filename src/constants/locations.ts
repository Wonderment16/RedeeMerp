import { Destination } from '../types';

export const RCCG_CAMP_LOCATIONS: Destination[] = [
  {
    id: 'main-auditorium',
    name: 'Main Auditorium (3km x 3km)',
    aliases: ['new auditorium', '3km auditorium', 'arena', 'shim'],
    coordinates: {
      lat: 6.8670,
      lng: 3.7250,
    },
    category: 'auditorium',
  },
  {
    id: 'main-gate',
    name: 'Main Gate',
    aliases: ['entrance', 'express gate', 'toll gate entrance'],
    coordinates: {
      lat: 6.8780,
      lng: 3.7320,
    },
    category: 'gate',
  },
  {
    id: 'youth-centre',
    name: 'Youth Centre',
    aliases: ['youth church', 'youth arena', 'rcyca'],
    coordinates: {
      lat: 6.8655,
      lng: 3.7285,
    },
    category: 'facility',
  },
  {
    id: 'bookshop',
    name: 'CRM Bookshop',
    aliases: ['book store', 'bible store', 'stationery shop'],
    coordinates: {
      lat: 6.8685,
      lng: 3.7300,
    },
    category: 'facility',
  },
  {
    id: 'medical-centre',
    name: 'Emmanuel Medical Centre',
    aliases: ['hospital', 'clinic', 'health center', 'emergency center'],
    coordinates: {
      lat: 6.8720,
      lng: 3.7280,
    },
    category: 'facility',
  },
  {
    id: 'bus-terminal',
    name: 'Bus Terminal',
    aliases: ['park', 'garage', 'transport park', 'shuttle terminal'],
    coordinates: {
      lat: 6.8760,
      lng: 3.7310,
    },
    category: 'transit',
  },
  {
    id: 'prayer-ground',
    name: 'Prayer Ground',
    aliases: ['prayer foyer', 'prayer mountain', 'prayer room', 'altar'],
    coordinates: {
      lat: 6.8630,
      lng: 3.7315,
    },
    category: 'facility',
  },
  {
    id: 'eateries',
    name: 'Eateries & Food Court',
    aliases: ['canteen', 'restaurant', 'food court', 'buka', 'kitchen'],
    coordinates: {
      lat: 6.8690,
      lng: 3.7295,
    },
    category: 'food',
  },
  {
    id: 'admin-office',
    name: 'Administrative Office',
    aliases: ['admin block', 'secretariat', 'governing office'],
    coordinates: {
      lat: 6.8705,
      lng: 3.7290,
    },
    category: 'office',
  },
  {
    id: 'camp-hostels',
    name: 'Camp Hostels',
    aliases: ['crm hostel', 'visitor lodge', 'chalets', 'accommodation'],
    coordinates: {
      lat: 6.8640,
      lng: 3.7260,
    },
    category: 'hostel',
  },
];
