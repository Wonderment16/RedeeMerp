import type { Destination, LatLng } from "../types";

export const RCCG_CAMP_CENTER: LatLng = { lat: 6.827482, lng: 3.462833 };

export const RCCG_CAMP_BOUNDS = {
  north: 6.83,
  south: 6.79,
  east: 3.47,
  west: 3.44,
};

export const RCCG_CAMP_LOCATIONS: Destination[] = [
  {
    id: "main-auditorium",
    name: "Main Auditorium",
    aliases: ["new auditorium", "3km auditorium", "big church", "arena"],
    coordinates: { lat: 6.8021797760352785, lng: 3.4478980745635894 },
    category: "auditorium",
  },
  {
    id: "main-gate",
    name: "Main Entrance",
    aliases: ["main gate", "entrance", "express gate", "camp gate", "toll gate"],
    coordinates: { lat: 6.827492, lng: 3.462833 },
    category: "gate",
  },
  {
    id: "youth-centre",
    name: "Youth Centre",
    aliases: ["youth church", "youth arena", "rcyca", "youth"],
    coordinates: { lat: 6.8265127320513574, lng: 3.4663684408847493 },
    category: "facility",
  },
  {
    id: "bookshop",
    name: "CRM Bookshop",
    aliases: ["book store", "bible store", "crm bookshop", "stationery"],
    coordinates: { lat: 6.816031129302908, lng: 3.454903154375755 },
    category: "facility",
  },
  {
    id: "medical-centre",
    name: "RCCG Health Village Center",
    aliases: ["medical centre", "medical center", "hospital", "clinic", "health centre", "emergency"],
    coordinates: { lat: 6.797173492016633, lng: 3.446081825337246 },
    category: "facility",
  },
  {
    id: "car-park-c",
    name: "Car Park C",
    aliases: ["field", "car park c", "park", "garage", "transport park", "shuttle"],
    coordinates: { lat: 6.810633443272448, lng: 3.4455250813578058 },
    category: "transit",
  },
  {
    id: "prayer-ground",
    name: "Prayer and Meditation Centre",
    aliases: ["prayer centre", "meditation centre", "altar", "pray"],
    coordinates: { lat: 6.799862894324902, lng: 3.45307813182887 },
    category: "facility",
  },
  {
    id: "supermarket",
    name: "CRM SuperMarket",
    aliases: ["food", "canteen", "restaurant", "food court", "buka", "kitchen"],
    coordinates: { lat: 6.819025170598574, lng: 3.4580236913409235 },
    category: "food",
  },
  {
    id: "admin-office",
    name: "National Secretariat",
    aliases: ["administrative office", "admin block", "secretariat", "governing office", "office"],
    coordinates: { lat: 6.801713712290273, lng: 3.45388231022573 },
    category: "office",
  },
  {
    id: "prayer-foyer",
    name: "Old Arena Prayer Foyer",
    aliases: ["foyer", "prayer hall", "prayer area"],
    coordinates: { lat: 6.805547040592805, lng: 3.447358367323825 },
    category: "facility",
  },
  {
    id: "protocol-car-park",
    name: "Car Park B",
    aliases: ["protocol parking", "vip park", "vip car park", "protocol"],
    coordinates: { lat: 6.79936899137386, lng: 3.4472845851251117 },
    category: "facility",
  },
  {
    id: "canaanland-market",
    name: "Canaanland Market",
    aliases: ["market", "cannanland market", "shops", "camp market"],
    coordinates: { lat: 6.810763021119975, lng: 3.4596192146689666 },
    category: "food",
  },
  {
    id: "open-heaven",
    name: "Open Heaven International Centre",
    aliases: ["open heaven", "open heavens parish", "parish"],
    coordinates: { lat: 6.817564398673122, lng: 3.4596871177584094},
    category: "facility",
  },
  {
    id: "old-international-office",
    name: "RCCG Old International Office",
    aliases: ["ppdc office", "old international office", "rccg old international office"],
    coordinates: { lat: 6.820185986711585, lng: 3.458557201382477 },
    category: "office",
  },
  {
    id: "redeemer-school",
    name: "The Redeemers High School",
    aliases: ["redeemer school", "rccg school", "redeemed high school", "rhs"],
    coordinates: { lat: 6.821395570004879, lng: 3.458416775051771 },
    category: "facility",
  },
  {
    id: "white-house-suite",
    name: "White House Suite",
    aliases: ["white house", "suite", "guest suite"],
    coordinates: { lat: 6.809450277364695, lng: 3.45807331464826 },
    category: "hostel",
  },
  {
    id: "crm-press",
    name: "CRM Press",
    aliases: ["press", "printing press", "rccg press"],
    coordinates: { lat: 6.814966396221583, lng: 3.452873850155848 },
    category: "office",
  },
];

export const POPULAR_DESTINATION_IDS = [
  "main-auditorium",
  "prayer-ground",
  "supermarket",
  "car-park-c",
  "bookshop",
  "admin-office",
  "medical-centre",
];
