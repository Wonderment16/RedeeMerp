import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function NavigateScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Navigate</Text>
      <Text style={styles.subtitle}>Say a destination or start walking...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#aaaaaa',
    textAlign: 'center',
  },
});
