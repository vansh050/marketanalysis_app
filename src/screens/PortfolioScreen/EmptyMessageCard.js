import {View, Text, TouchableOpacity} from 'react-native';
import {CandlestickChartIcon} from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import {useNavigation} from '@react-navigation/native';
import {useConfig} from '../../context/ConfigContext';

const RenderEmptyMessageCard = ({value}) => {
  const navigation = useNavigation();

  // Get dynamic colors from config
  const config = useConfig();
  const gradient1 = config?.gradient1 || '#0076FB';
  const gradient2 = config?.gradient2 || '#002651';
  const mainColor = config?.mainColor || '#0056B7';

  return (
    <LinearGradient
      colors={[gradient1, gradient2]}
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        marginVertical: 20,
        marginHorizontal: 20,
        borderRadius: 20,
        overflow: 'hidden',
        width: '90%',
        alignSelf: 'center',
      }}>
      {/* Glow circles */}
      <View
        style={{
          position: 'absolute',
          top: -80,
          right: -80,
          width: 200,
          height: 200,
          borderRadius: 100,
          backgroundColor: 'rgba(255,255,255,0.12)',
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: -60,
          left: -60,
          width: 180,
          height: 180,
          borderRadius: 90,
          backgroundColor: 'rgba(255,255,255,0.08)',
        }}
      />

      {/* Icon container */}
      <LinearGradient
        colors={[gradient1, gradient2]}
        style={{
          width: 90,
          height: 90,
          borderRadius: 45,
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: 20,
          shadowColor: gradient2,
          shadowOffset: {width: 0, height: 4},
          shadowOpacity: 0.25,
          shadowRadius: 8,
          elevation: 6,
        }}>
        <View
          style={{
            width: 70,
            height: 70,
            borderRadius: 35,
            backgroundColor: 'rgba(255,255,255,0.2)',
            justifyContent: 'center',
            alignItems: 'center',
          }}>
          <View
            style={{
              width: 50,
              height: 50,
              borderRadius: 25,
              backgroundColor: 'rgba(255,255,255,0.85)',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
            <CandlestickChartIcon size={28} color={mainColor} />
          </View>
        </View>
      </LinearGradient>

      {/* Title */}
      <Text
        style={{
          fontFamily: 'Satoshi-SemiBold',
          fontSize: 18,
          color: 'white',
          textAlign: 'center',
          marginBottom: 12,
        }}>
        {value === 'positions'
          ? 'No Positions Data Available'
          : value === 'holdings'
          ? 'No Holdings Data Available'
          : 'No model portfolio subscribed'}
      </Text>

      {/* Subtitle */}
      <Text
        style={{
          fontFamily: 'Satoshi-Medium',
          fontSize: 14,
          color: 'rgba(255,255,255,0.8)',
          textAlign: 'center',
          maxWidth: '85%',
          lineHeight: 20,
          marginBottom: 16,
        }}>
        {value === 'positions'
          ? 'Place orders now to seize opportunities & book profits'
          : value === 'holdings'
          ? 'Login to your broker to see holdings.'
          : 'Subscribe to a model portfolio for getting more detail'}
      </Text>

      {value === 'holdings' && (
        <TouchableOpacity
          onPress={() => navigation.navigate('Broker Setting')}
          style={{
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text
            style={{
              fontFamily: 'Satoshi-Bold',
              fontSize: 14,
              color: 'rgba(255,255,255,0.8)',
              textDecorationLine: 'underline',
              lineHeight: 20,
            }}>
            Connect Broker
          </Text>
        </TouchableOpacity>
      )}
    </LinearGradient>
  );
};

export default RenderEmptyMessageCard;
