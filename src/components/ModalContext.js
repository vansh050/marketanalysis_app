// ModalContext.js
import React, { createContext, useState, useContext } from 'react';

const ModalContext = createContext();

export const ModalProvider = ({ children }) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [successclosemodel,setsuccessclosemodel]=useState(false);

  const showAddToCartModal = () => setIsModalVisible(true);
  const hideAddToCartModal = () => setIsModalVisible(false);

  return (
    <ModalContext.Provider value={{ isModalVisible, showAddToCartModal, hideAddToCartModal,successclosemodel,setsuccessclosemodel}}>
      {children}
    </ModalContext.Provider>
  );
};

export const useModal = () => useContext(ModalContext);
