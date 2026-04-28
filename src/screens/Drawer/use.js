import { ArrowLeft, ChevronLast, ChevronLeft } from "lucide-react-native";

const payments = [
  {
    id: '1',
    icon: 'A',
    name: 'Alpha 100',
    date: 'Invested on 07th Sept, 2024',
    amount: '₹999',
    bgColor: '#000000'
  },
  {
    id: '2',
    icon: '₹',
    name: 'Alpha 100',
    date: 'Invested on 07th Sept, 2024',
    amount: '₹5,999',
    bgColor: '#FEF3C7'
  },
  {
    id: '3',
    icon: '3',
    name: 'Alpha 100',
    date: 'Invested on 07th Sept, 2024',
    amount: '₹1,999',
    bgColor: '#059669'
  },
  {
    id: '4',
    icon: '⚡',
    name: 'Alpha 100',
    date: 'Invested on 07th Sept, 2024',
    amount: '₹8,99',
    bgColor: '#E9D5FF'
  },
  {
    id: '5',
    icon: '100',
    name: 'Alpha 100',
    date: 'Invested on 07th Sept, 2024',
    amount: '₹3,999',
    bgColor: '#1E3A8A'
  }
];

const renderPaymentItem = ({ item }) => (
  <View style={styles.paymentItem}>
    <View style={styles.leftContent}>
      <View style={[styles.iconContainer, { backgroundColor: item.bgColor }]}>
        <Text style={[
          styles.iconText, 
          { color: ['#000000', '#FEF3C7'].includes(item.bgColor) ? '#000' : '#FFF' }
        ]}>
          {item.icon}
        </Text>
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.nameText}>{item.name}</Text>
        <Text style={styles.dateText}>{item.date}</Text>
      </View>
    </View>
    <View style={styles.rightContent}>
      <Text style={styles.amountText}>{item.amount}</Text>
      <TouchableOpacity>
        <Text style={styles.invoiceText}>View Invoice</Text>
      </TouchableOpacity>
    </View>
  </View>
);

const ListHeaderComponent = () => (
  <View style={styles.header}>
    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
      <ChevronLeft size={24} color="black" />
    </TouchableOpacity>
    <Text style={styles.headerTitle}>Payment History</Text>
  </View>
);

return (
  <View style={styles.container}>
    <FlatList
      data={payments}
      renderItem={renderPaymentItem}
      keyExtractor={item => item.id}
      ListHeaderComponent={ListHeaderComponent}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    />
  </View>
);
};

const styles = StyleSheet.create({
container: {
  flex: 1,
  backgroundColor: '#FFFFFF',
},
listContent: {
  paddingHorizontal: 16,
},
header: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingVertical: 16,
  marginBottom: 8,
},
backButton: {
  padding: 4,
},
headerTitle: {
  fontSize: 20,
  fontWeight: '600',
  marginLeft: 8,
},
paymentItem: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingVertical: 12,
},
leftContent: {
  flexDirection: 'row',
  alignItems: 'center',
},
iconContainer: {
  width: 40,
  height: 40,
  borderRadius: 8,
  justifyContent: 'center',
  alignItems: 'center',
},
iconText: {
  fontSize: 14,
  fontWeight: '500',
},
textContainer: {
  marginLeft: 12,
},
nameText: {
  fontSize: 16,
  fontWeight: '600',
  color: '#000000',
},
dateText: {
  fontSize: 14,
  color: '#6B7280',
  marginTop: 2,
},
rightContent: {
  alignItems: 'flex-end',
},
amountText: {
  fontSize: 16,
  fontWeight: '600',
  color: '#000000',
},
invoiceText: {
  fontSize: 14,
  color: '#2563EB',
  marginTop: 2,
},
});
