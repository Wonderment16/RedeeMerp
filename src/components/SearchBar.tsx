import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { RCCG_CAMP_LOCATIONS } from "../constants/locations";
import { Destination } from "../types";

interface SearchBarProps {
  onDestinationSelected: (destination: Destination) => void;
  placeholder?: string;
}

function SearchIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path
        d="M9.5 3a6.5 6.5 0 015.18 10.43l4.45 4.44-1.42 1.42-4.44-4.45A6.5 6.5 0 119.5 3zm0 2a4.5 4.5 0 100 9 4.5 4.5 0 000-9z"
        fill="#666666"
      />
    </Svg>
  );
}

function CategoryIcon({ category }: { category: Destination["category"] }) {
  const path = useMemo(() => {
    switch (category) {
      case "auditorium":
        return "M12 3L4 9v12h16V9l-8-6zm0 11a3 3 0 110-6 3 3 0 010 6z";
      case "food":
        return "M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm4-3v8h2.5v8H20V2c-2.76 0-5 2.24-5 4z";
      case "transit":
        return "M4 16c0 .88.39 1.67 1 2.22V20a1 1 0 001 1h1a1 1 0 001-1v-1h8v1a1 1 0 001 1h1a1 1 0 001-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10z";
      case "gate":
        return "M19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z";
      case "hostel":
        return "M7 13c1.66 0 3-1.34 3-3S8.66 7 7 7s-3 1.34-3 3 1.34 3 3 3zm12-6h-8v7H3V5H1v15h2v-3h18v3h2v-9c0-2.21-1.79-4-4-4z";
      case "office":
        return "M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2z";
      default:
        return "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z";
    }
  }, [category]);

  return (
    <View style={styles.categoryIcon}>
      <Svg width={18} height={18} viewBox="0 0 24 24">
        <Path d={path} fill="#FFFFFF" />
      </Svg>
    </View>
  );
}

export default function SearchBar({
  onDestinationSelected,
  placeholder = "Where do you want to go?",
}: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timeoutId = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timeoutId);
  }, [query]);

  const results = useMemo(() => {
    const normalizedQuery = debouncedQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return [];
    }

    return RCCG_CAMP_LOCATIONS.filter((destination) => {
      return (
        destination.name.toLowerCase().includes(normalizedQuery) ||
        destination.category.toLowerCase().includes(normalizedQuery) ||
        destination.aliases.some((alias) =>
          alias.toLowerCase().includes(normalizedQuery),
        )
      );
    }).slice(0, 6);
  }, [debouncedQuery]);

  const handleSelect = (destination: Destination) => {
    onDestinationSelected(destination);
    setQuery("");
    setDebouncedQuery("");
    Keyboard.dismiss();
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputWrapper}>
        <SearchIcon />
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder={placeholder}
          placeholderTextColor="#666666"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Search destinations"
        />
      </View>

      {results.length > 0 ? (
        <View style={styles.results}>
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.resultRow}
                onPress={() => handleSelect(item)}
                accessibilityLabel={`Select ${item.name}`}
                accessibilityRole="button"
              >
                <CategoryIcon category={item.category} />
                <Text style={styles.resultName} numberOfLines={1}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    zIndex: 2,
  },
  inputWrapper: {
    minHeight: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    backgroundColor: "#F6F6F6",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    color: "#1A1A1A",
    fontSize: 16,
    marginLeft: 8,
    minHeight: 48,
  },
  results: {
    marginTop: 8,
    maxHeight: 150,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  resultRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    borderBottomColor: "#E5E5E5",
    borderBottomWidth: 1,
  },
  categoryIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    backgroundColor: "#8B0000",
  },
  resultName: {
    flex: 1,
    color: "#1A1A1A",
    fontSize: 15,
    fontWeight: "700",
  },
});
