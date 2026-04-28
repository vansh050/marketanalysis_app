
import { SocialProofProvider } from "./SocialProofProvider";
import { CartProvider } from "./CartContext";
import { ModalProvider } from "./ModalContext";
const AppProviders = ({ children }) => (
    <SocialProofProvider>
      <CartProvider>
        <ModalProvider>{children}</ModalProvider>
      </CartProvider>
    </SocialProofProvider>
  );
  
  export default AppProviders;
  