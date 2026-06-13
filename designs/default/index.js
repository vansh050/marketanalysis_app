/**
 * ============================================================================
 * designs/default — DEFAULT VARIANT ROOT
 * ============================================================================
 *
 * The default variant is the **contract floor** for the design system. Every
 * primitive / composite / screen key registered in `components` here MUST be
 * implemented by every other variant (or else fall back to default at the
 * registry level).
 *
 * Adding a new component key to the design system is a TWO-step change:
 *   1. Add the implementation file in `designs/default/<layer>/<Name>.js`
 *   2. Register it in the `components` map below
 *
 * Custom variants are registered in `designs/registry.js`. They re-export
 * the same shape (`{ name, tokens, components }`) and override only the keys
 * they want to customise; unspecified keys fall through to default.
 *
 * Component-key naming: dot-namespaced by layer.
 *   primitives.<Name>   e.g. primitives.Button
 *   composites.<Name>   e.g. composites.IgnoreStockCard (Phase D+)
 *   screens.<Name>      e.g. screens.Home               (Phase E+)
 *
 * See docs/DESIGN_SYSTEM_ARCHITECTURE.md § Registry for resolution rules.
 * ============================================================================
 */

import * as tokens from './tokens';

// Phase C primitives (2026-05-01)
import Text from './primitives/Text';
import Button from './primitives/Button';
import Card from './primitives/Card';
import Input from './primitives/Input';
import Spinner from './primitives/Spinner';
import Icon from './primitives/Icon';
import Pill from './primitives/Pill';
import Divider from './primitives/Divider';
import Toast from './primitives/Toast';
import ModalShell from './primitives/ModalShell';

// Phase D composites (2026-05-01)
import RebalanceDetailsModal from './composites/RebalanceDetailsModal';

// Phase H composites (2026-05-02) — non-SDK-bound modals
import DeleteAdviceModal from './composites/DeleteAdviceModal';
import GttDetailsModal from './composites/GttDetailsModal';
import GttSuccessModal from './composites/GttSuccessModal';
import HoldingsMigrationModal from './composites/HoldingsMigrationModal';
import BasketTradeModal from './composites/BasketTradeModal';
import BrokerSelectionModal from './composites/BrokerSelectionModal';

// Phase E.1 composites + screens (2026-05-01)
import OrderRow from './composites/OrderRow';
import OrderScreen from './screens/OrderScreen';

// Phase F composites + screens (2026-05-01) — auth + account
import TermsModalComposite from './composites/TermsModal';
import ResetPasswordScreen from './screens/ResetPassword';
import EmailScreenAppleLoginScreen from './screens/EmailScreenAppleLogin';
import LogOutScreen from './screens/LogOutScreen';
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import SignUpRADetails from './screens/SignUpRADetails';
import PhoneNumberScreen from './screens/PhoneNumberScreen';
import ChangeAdvisor from './screens/ChangeAdvisor';
import HomeScreen from './screens/HomeScreen';

// Phase G screens (2026-05-02) — Drawer batch 1: clean-extracts
import PrivacyPolicyScreen from './screens/PrivacyPolicyScreen';
import TermandConditionsScreen from './screens/TermandConditionsScreen';
import ProductCatalogScreen from './screens/ProductCatalogScreen';
import ReviewScreen from './screens/ReviewScreen';
import CustomTabBarOrder from './screens/CustomTabBarOrder';

// Phase G screens (2026-05-02) — KnowledgeHub wrappers (batch 3)
import BlogScreen from './screens/BlogScreen';
import VideoScreen from './screens/VideoScreen';
import PdfScreen from './screens/PdfScreen';

// Phase G screens (2026-05-02) — needs-logic-extraction (batch 2)
import PaymentHistoryScreen from './screens/PaymentHistoryScreen';
import DistributionRowGrid from './screens/DistributionRowGrid';
import AccountSettingsScreen from './screens/AccountSettingsScreen';
import BespokePerformanceScreen from './screens/BespokePerformanceScreen';

// Phase G screens (2026-05-02) — heavy screens (batch 4)
import IgnoreTradesScreen from './screens/IgnoreTradesScreen';
import WatchlistScreen from './screens/WatchlistScreen';

// Phase I screens (2026-05-02) — Model Portfolio
import ModelPortfolioScreen from './screens/ModelPortfolioScreen';
import MPPerformanceScreen from './screens/MPPerformanceScreen';
import MPInvestNowModal from './screens/MPInvestNowModal';

// Phase J screens (2026-05-05) — Portfolio (bottom-tab Portfolio)
import PortfolioScreen from './screens/PortfolioScreen';

// Phase J follow-up (2026-05-06) — Notification list (HTML § 08)
import NotificationListScreen from './screens/NotificationListScreen';

// Phase G composites (2026-05-02) — heavy composites (batch 4)
import StockCard from './composites/StockCard';
import BasketCard from './composites/BasketCard';

// Phase I composites (2026-05-02) — Model Portfolio screens
import CustomTabbarMPPerformance from './composites/CustomTabbarMPPerformance';
import EmptyStateMP from './composites/EmptyStateMP';
import ModelPFCard from './composites/ModelPFCard';
import MPCard from './composites/MPCard';

// Courses (2026-05-23) — LiveKit viewer composite (placeholder; see file header for activation)
import LiveRoom from './composites/LiveRoom';
// Courses Phase 2 (2026-05-23) — Gumlet VOD player (WebView; see file header for native-video swap)
import GumletPlayer from './composites/GumletPlayer';
// Web-parity (P1) — RIA AUM value-history card (self-gated on riaBillingEnabled).
import AumPerformanceCard from './composites/AumPerformanceCard';
// Web-parity (P2) — Portfolio Health tool sheet (self-gated on portfolioHealthEnabled).
import PortfolioHealthSheet from './composites/PortfolioHealthSheet';
// Web-parity (P3) — NBA action banner + status strip (self-gated on nbaHomeEnabled).
import NbaBanner from './composites/NbaBanner';
// Web-parity (P4) — eNACH provisional-access banner (self-shows only when a mandate is pending).
import ProvisionalBanner from './composites/ProvisionalBanner';
// Web-parity (P5) — Transition (advice) card. DEFERRED/unmounted; gated transitionEngineEnabled.
import PortfolioTransitionCard from './composites/PortfolioTransitionCard';

const variant = {
    name: 'default',
    tokens,
    components: {
        // Primitives (Phase C)
        'primitives.Text': Text,
        'primitives.Button': Button,
        'primitives.Card': Card,
        'primitives.Input': Input,
        'primitives.Spinner': Spinner,
        'primitives.Icon': Icon,
        'primitives.Pill': Pill,
        'primitives.Divider': Divider,
        'primitives.Toast': Toast,
        'primitives.ModalShell': ModalShell,
        // Composites (Phase D)
        'composites.RebalanceDetailsModal': RebalanceDetailsModal,
        // Composites (Phase H — non-SDK-bound modals)
        'composites.DeleteAdviceModal': DeleteAdviceModal,
        'composites.GttDetailsModal': GttDetailsModal,
        'composites.GttSuccessModal': GttSuccessModal,
        'composites.HoldingsMigrationModal': HoldingsMigrationModal,
        'composites.BasketTradeModal': BasketTradeModal,
        'composites.BrokerSelectionModal': BrokerSelectionModal,
        // Composites (Phase E.1)
        'composites.OrderRow': OrderRow,
        // Composites (Phase F)
        'composites.TermsModal': TermsModalComposite,
        // Screens (Phase E.1)
        'screens.OrderScreen': OrderScreen,
        // Screens (Phase F — auth/account batch 1: clean-extracts)
        'screens.ResetPassword': ResetPasswordScreen,
        'screens.EmailScreenAppleLogin': EmailScreenAppleLoginScreen,
        'screens.LogOutScreen': LogOutScreen,
        // Screens (Phase F — auth/account batch 2: LoginScreen + SignupScreen)
        'screens.LoginScreen': LoginScreen,
        'screens.SignupScreen': SignupScreen,
        // Screens (Phase F — auth/account batch 3: SignUpRADetails + PhoneNumberScreen)
        'screens.SignUpRADetails': SignUpRADetails,
        'screens.PhoneNumberScreen': PhoneNumberScreen,
        // Screens (Phase F — auth/account batch 4: ChangeAdvisor)
        'screens.ChangeAdvisor': ChangeAdvisor,
        // Screens (Phase E.2 — minimal registry hookup; deep split deferred to Phase E.3)
        'screens.HomeScreen': HomeScreen,
        // Screens (Phase G — Drawer batch 1: clean-extracts)
        'screens.PrivacyPolicyScreen': PrivacyPolicyScreen,
        'screens.TermandConditionsScreen': TermandConditionsScreen,
        'screens.ProductCatalogScreen': ProductCatalogScreen,
        'screens.ReviewScreen': ReviewScreen,
        'screens.CustomTabBarOrder': CustomTabBarOrder,
        // Screens (Phase G — KnowledgeHub wrappers, batch 3)
        'screens.BlogScreen': BlogScreen,
        'screens.VideoScreen': VideoScreen,
        'screens.PdfScreen': PdfScreen,
        // Screens (Phase G — needs-logic-extraction, batch 2)
        'screens.PaymentHistoryScreen': PaymentHistoryScreen,
        'screens.DistributionRowGrid': DistributionRowGrid,
        'screens.AccountSettingsScreen': AccountSettingsScreen,
        'screens.BespokePerformanceScreen': BespokePerformanceScreen,
        // Screens (Phase G — heavy screens, batch 4)
        'screens.IgnoreTradesScreen': IgnoreTradesScreen,
        'screens.WatchlistScreen': WatchlistScreen,
        // Composites (Phase G — heavy composites, batch 4)
        'composites.StockCard': StockCard,
        'composites.BasketCard': BasketCard,
        // Composites (Phase I — Model Portfolio)
        'composites.CustomTabbarMPPerformance': CustomTabbarMPPerformance,
        'composites.EmptyStateMP': EmptyStateMP,
        'composites.ModelPFCard': ModelPFCard,
        'composites.MPCard': MPCard,
        // Screens (Phase I — Model Portfolio)
        'screens.ModelPortfolioScreen': ModelPortfolioScreen,
        'screens.MPPerformanceScreen': MPPerformanceScreen,
        'screens.MPInvestNowModal': MPInvestNowModal,
        // Screens (Phase J — bottom-tab Portfolio)
        'screens.PortfolioScreen': PortfolioScreen,
        // Screens (Phase J follow-up — Notification list)
        'screens.NotificationListScreen': NotificationListScreen,
        // Courses (2026-05-23) — LiveKit viewer (placeholder until @livekit/react-native installed)
        'composites.LiveRoom': LiveRoom,
        // Courses Phase 2 (2026-05-23) — Gumlet VOD player (WebView-based; works today)
        'composites.GumletPlayer': GumletPlayer,
        // Web-parity (P1) — RIA AUM value-history card
        'composites.AumPerformanceCard': AumPerformanceCard,
        // Web-parity (P2) — Portfolio Health tool sheet
        'composites.PortfolioHealthSheet': PortfolioHealthSheet,
        // Web-parity (P3) — NBA action banner + status strip
        'composites.NbaBanner': NbaBanner,
        // Web-parity (P4) — eNACH provisional-access banner
        'composites.ProvisionalBanner': ProvisionalBanner,
        // Web-parity (P5) — Transition (advice) card; deferred/unmounted
        'composites.PortfolioTransitionCard': PortfolioTransitionCard,
    },
    // SDK widget defaults — all 10 overridable slots.
    // Each file in sdk/ re-exports the SDK built-in OR provides a
    // standalone default. Custom variants override individual files.
    sdk: require('./sdk').default,
};

export default variant;
