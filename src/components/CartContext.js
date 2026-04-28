// CartContext.js
//
// Single source of truth for the global cart badge count.
//
// Storage is AsyncStorage (`cartItems` key) — mutated by StockAdvices /
// AddtoCartModal. Any mutation emits `cartUpdated` on `EventEmitter`, and
// this provider re-reads storage on every emit so `cartCount` is always in
// sync regardless of which screen triggered the change.
import React, {createContext, useState, useEffect, useContext} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import eventEmitter from './EventEmitter';

const CartContext = createContext();

export const CartProvider = ({children}) => {
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    const readCart = async () => {
      try {
        const raw = await AsyncStorage.getItem('cartItems');
        const items = raw ? JSON.parse(raw) : [];
        if (mounted) setCartCount(Array.isArray(items) ? items.length : 0);
      } catch (err) {
        // Keep last-known count on read failure — don't zero out.
      }
    };
    readCart();
    eventEmitter.on('cartUpdated', readCart);
    return () => {
      mounted = false;
      eventEmitter.off('cartUpdated', readCart);
    };
  }, []);

  return (
    <CartContext.Provider value={{cartCount, setCartCount}}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
