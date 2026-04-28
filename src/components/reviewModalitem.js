import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Trash2Icon } from 'lucide-react-native'; // Assuming you are using lucide icons

const ReviewItemCard = ({ stock, price, order, quantity, orderType, onDelete }) => {
  return (
    <View style={styles.cardContainer}>
      <Text style={styles.text}>{stock}</Text>
      <Text style={styles.text}>{price}</Text>
      <Text style={styles.text}>{order}</Text>
      <Text style={styles.text}>{quantity}</Text>
      <Text style={styles.text}>{orderType}</Text>
      <TouchableOpacity onPress={onDelete} style={styles.deleteButton}>
        <Trash2Icon size={20} color="#ff0000" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#f1f1f1',
    marginVertical: 5,
    borderRadius: 5,
  },
  text: {
    fontSize: 14,
    fontWeight: 'bold',
    flex: 1, // This allows the text to take up available space evenly
    textAlign: 'center',
  },
  deleteButton: {
    padding: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ReviewItemCard;
